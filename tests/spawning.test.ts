import { describe, expect, it } from 'vitest'
import { createInitialState } from '../game/initialState'
import { executeTurn } from '../game/engine'
import { DEFAULT_GAME_CONFIG, ENEMY_TIER_PROGRESSION, ENEMY_TIER_UNLOCK_PLAYER_TIER, getMonsterDefinition, getMonsterStats } from '../game/config'
import { createSpawnQueue, nextSpawnEntry, spawnNextMonster } from '../game/spawning'
import { spawnDistribution, unlockTurn } from '../game/spawn'
import { nextSeed } from '../game/rng'
import type { GameState, Monster } from '../game/types'

const { enemySpawnCurve: _enemySpawnCurve, ...legacyRules } = DEFAULT_GAME_CONFIG
const legacyConfig = {
  ...legacyRules,
  enemyTierProgression: ENEMY_TIER_PROGRESSION,
  enemyTierUnlockPlayerTier: ENEMY_TIER_UNLOCK_PLAYER_TIER
}

function monster(id: string, faction: Monster['faction'], tier: number, overrides: Partial<Monster> = {}): Monster {
  const stats = getMonsterStats('dragon', tier)
  return {
    id,
    faction,
    typeId: 'dragon',
    tier,
    hp: stats.maxHp,
    ...stats,
    movable: true,
    ...overrides
  }
}

describe('deterministic spawn timeline', () => {
  it('previews ten reproducible entries from the run seed', () => {
    const first = createInitialState(42)
    const second = createInitialState(42)

    expect(first.spawnQueue).toHaveLength(10)
    expect(first.spawnQueue).toEqual(second.spawnQueue)
    expect(first.rngSeed).toBe(second.rngSeed)
    expect(first.spawnQueue.every(({ kind, typeId, tier }) =>
      (kind === 'friend' || kind === 'enemy')
      && typeId.length > 0
      && tier === 1
    )).toBe(true)
    expect(first.spawnQueue.every(({ kind, typeId }) =>
      getMonsterDefinition(typeId).faction === (kind === 'friend' ? 'player' : 'enemy')
    )).toBe(true)
    expect(new Set(first.spawnQueue.map(({ kind }) => kind))).toEqual(new Set(['friend', 'enemy']))
  })

  it('spawns one queued monster and advances the preview after a valid turn', () => {
    const state = createInitialState(42)
    const previousQueue = state.spawnQueue
    const result = executeTurn(state, 'left')
    const spawned = result.state.cells.filter(monster => monster?.id.startsWith('spawn-'))

    expect(result.valid).toBe(true)
    expect(result.state.turn).toBe(1)
    expect(spawned).toHaveLength(1)
    expect(spawned[0]).toMatchObject({
      id: 'spawn-1',
      typeId: previousQueue[0].typeId,
      tier: previousQueue[0].tier,
      faction: previousQueue[0].kind === 'friend' ? 'player' : 'enemy'
    })
    expect(result.events.at(-1)).toEqual({
      type: 'spawn',
      monsterId: 'spawn-1',
      at: result.state.cells.findIndex(monster => monster?.id === 'spawn-1'),
      kind: previousQueue[0].kind
    })
    expect(result.state.spawnQueue).toHaveLength(10)
    expect(result.state.spawnQueue.slice(0, 9)).toEqual(previousQueue.slice(1))
    expect(result.state.spawnQueue[9]).toBeDefined()
    expect(result.stateBeforeSpawn?.spawnQueue).toEqual(previousQueue)
    expect(result.stateBeforeSpawn?.cells.some(monster => monster?.id === 'spawn-1')).toBe(false)
  })

  it('chooses a seeded random free tile rather than always using the first tile', () => {
    const getSpawnIndex = (seed: number) => {
      const state = createInitialState(seed)
      const result = (['left', 'right', 'up', 'down'] as const)
        .map(direction => executeTurn(state, direction))
        .find(turn => turn.valid)
      if (!result) {
        throw new Error('Expected a valid move from the initial state')
      }
      const spawnEvent = result.events.find(event => event.type === 'spawn')
      if (spawnEvent?.type !== 'spawn') {
        throw new Error('Expected a spawn event after a valid turn')
      }
      return spawnEvent.at
    }

    const indices = [1, 2, 3, 4, 5].map(getSpawnIndex)

    expect(new Set(indices).size).toBeGreaterThan(1)
    expect(getSpawnIndex(42)).toBe(getSpawnIndex(42))
  })

  it('does not consume or refill the preview after an invalid turn', () => {
    const initialState = createInitialState(42)
    const cells: GameState['cells'] = Array(16).fill(null)
    cells[3] = initialState.cells[5]
    const state = { ...initialState, cells }
    const result = executeTurn(state, 'right')

    expect(result.valid).toBe(false)
    expect(result.state).toBe(state)
    expect(result.state.spawnQueue).toBe(state.spawnQueue)
    expect(result.state.rngSeed).toBe(state.rngSeed)
    expect(result.events).toEqual([])
  })

  it('replays the same seeded run and inputs identically', () => {
    const playRun = () => {
      let state = createInitialState(1234)
      for (const direction of ['left', 'down', 'right'] as const) {
        state = executeTurn(state, direction).state
      }
      return state
    }

    expect(playRun()).toEqual(playRun())
  })

  it('unlocks on a friendly tier-3 merge even if the result dies, and remembers the first turn', () => {
    const state = {
      ...createInitialState(42, legacyConfig),
      width: 4,
      height: 1,
      turn: 20,
      cells: [
        monster('enemy', 'enemy', 1, { movable: false, atk: 100, hp: 100, maxHp: 100 }),
        monster('first', 'player', 2),
        monster('second', 'player', 2),
        monster('survivor', 'player', 1, { movable: false })
      ]
    }

    const result = executeTurn(state, 'left')

    expect(result.state.enemyTierUnlockTurn).toBe(21)
    expect(result.stateAfterMovement?.enemyTierUnlockTurn).toBe(21)
    expect(result.state.cells.some(item => item?.faction === 'player' && item.tier === 3)).toBe(false)
    expect(result.state.spawnQueue.slice(0, -1)).toEqual(state.spawnQueue.slice(1))

    const repeat = executeTurn({
      ...state,
      turn: 40,
      enemyTierUnlockTurn: 21
    }, 'left')
    expect(repeat.state.enemyTierUnlockTurn).toBe(21)
  })

  it('does not unlock from enemy merges or merely having a tier-3 ally', () => {
    const base = createInitialState(42, legacyConfig)
    const result = executeTurn({
      ...base,
      width: 4,
      height: 1,
      turn: 500,
      cells: [
        monster('first', 'enemy', 2),
        monster('second', 'enemy', 2),
        null,
        monster('ally', 'player', 3, { movable: false })
      ]
    }, 'left')

    expect(result.events.some(event => event.type === 'merge')).toBe(true)
    expect(result.state.enemyTierUnlockTurn).toBeNull()
    expect(result.state.spawnQueue.every(entry => entry.tier === 1)).toBe(true)
  })

  it('uses the unlock turn when refilling the queue without changing the existing preview', () => {
    const state = { ...createInitialState(42, legacyConfig), turn: 2000, enemyTierUnlockTurn: null }
    const seed = Array.from({ length: 1000 }, (_, index) => index)
      .find(rngSeed => spawnNextMonster({ ...state, rngSeed, enemyTierUnlockTurn: 1 }).spawnQueue.at(-1)!.tier > 1)
    expect(seed).toBeDefined()
    if (seed === undefined) throw new Error('Expected a seed that produces a higher-tier enemy')
    const locked = spawnNextMonster({ ...state, rngSeed: seed })
    const unlocked = spawnNextMonster({ ...state, rngSeed: seed, enemyTierUnlockTurn: 1 })

    expect(locked.spawnQueue.slice(0, -1)).toEqual(state.spawnQueue.slice(1))
    expect(unlocked.spawnQueue.slice(0, -1)).toEqual(state.spawnQueue.slice(1))
    expect(locked.spawnQueue.at(-1)?.tier).toBe(1)
    expect(unlocked.spawnQueue.at(-1)).toMatchObject({ kind: 'enemy', tier: expect.any(Number) })
    expect(unlocked.spawnQueue.at(-1)!.tier).toBeGreaterThan(1)
    expect(unlocked).toEqual(spawnNextMonster({ ...state, rngSeed: seed, enemyTierUnlockTurn: 1 }))
  })

  it('spawns a queued higher-tier enemy with the correct stats', () => {
    const state = createInitialState(42)
    state.spawnQueue[0] = { kind: 'enemy', typeId: 'skeletDragon', tier: 4 }

    const spawn = spawnNextMonster(state)

    expect(spawn.cells[spawn.event.at]).toMatchObject({
      faction: 'enemy',
      tier: 4,
      hp: getMonsterStats('skeletDragon', 4).maxHp,
      ...getMonsterStats('skeletDragon', 4)
    })
  })

  it('rejects queued monster types assigned to the wrong faction', () => {
    const state = createInitialState(42)
    state.spawnQueue[0] = { kind: 'friend', typeId: 'skeletDragon', tier: 1 }

    expect(() => spawnNextMonster(state)).toThrow('cannot spawn for faction player')
  })

  it('does not advance progression on an invalid turn', () => {
    const state = {
      ...createInitialState(42),
      width: 1,
      height: 1,
      cells: [monster('ally', 'player', 3)],
      turn: 30,
      enemyTierUnlockTurn: 10
    }

    const result = executeTurn(state, 'left')

    expect(result.valid).toBe(false)
    expect(result.state).toBe(state)
    expect(result.state.enemyTierUnlockTurn).toBe(10)
  })

  it('increases higher enemy tier chances at decreasing rates and caps them', () => {
    const sample = (turns: number) => {
      const counts = new Map<number, number>()
      let enemies = 0
      let seed = 42
      for (let index = 0; index < 100000; index++) {
        const next = nextSpawnEntry(seed, turns, legacyConfig)
        seed = next.rngSeed
        if (next.entry.kind === 'enemy') {
          enemies++
          counts.set(next.entry.tier, (counts.get(next.entry.tier) ?? 0) + 1)
        } else {
          expect(next.entry.tier).toBe(1)
        }
      }
      return ENEMY_TIER_PROGRESSION.map(({ tier }) => (counts.get(tier) ?? 0) / enemies)
    }
    const expected = (turns: number) =>
      ENEMY_TIER_PROGRESSION.map(({ chancePerTurn, maxChance }) => Math.min(turns * chancePerTurn, maxChance))

    const locked = sample(0)
    const early = sample(25)
    const later = sample(100)
    const capped = sample(1000)
    expect(locked).toEqual(ENEMY_TIER_PROGRESSION.map(() => 0))
    expect(expected(1000)).toEqual(ENEMY_TIER_PROGRESSION.map(({ maxChance }) => maxChance))
    ENEMY_TIER_PROGRESSION.forEach((_, index) => {
      expect(early[index]).toBeCloseTo(expected(25)[index]!, 2)
      expect(later[index]).toBeCloseTo(expected(100)[index]!, 2)
      expect(capped[index]).toBeCloseTo(expected(1000)[index]!, 2)
      expect(later[index]).toBeGreaterThan(early[index]!)
    })
    expect(sample(1000)).toEqual(capped)
  })

  it('uses the balancer distribution for the requested spawn turn without a merge unlock', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      friendSpawnChance: 0.4,
      enemySpawnCurve: { difficultyBuffer: 0.2, maxActiveTiers: 5, peakPosition: 0.35, maxTier: 10 }
    }
    const curve = { ...config.enemySpawnCurve, friendlySpawnRate: config.friendSpawnChance }
    const turn = 100
    const expected = spawnDistribution(turn, curve)
    const counts = new Map<number, number>()
    let seed = 42
    let enemies = 0
    for (let index = 0; index < 50000; index++) {
      const next = nextSpawnEntry(seed, 0, config, turn)
      seed = next.rngSeed
      if (next.entry.kind === 'enemy') {
        enemies++
        counts.set(next.entry.tier, (counts.get(next.entry.tier) ?? 0) + 1)
      } else {
        expect(next.entry.tier).toBe(config.spawnTier)
      }
    }
    for (const row of expected) {
      expect((counts.get(row.tier) ?? 0) / enemies).toBeCloseTo(row.probability, 2)
    }
    expect([...counts.keys()].every(tier => expected.some(row => row.tier === tier))).toBe(true)
    expect(expected.some(row => row.tier > 1)).toBe(true)
  })

  it('generates the preview for future spawn turns and preserves it when refilling', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      spawnQueueLength: 30,
      friendSpawnChance: 0.5,
      enemySpawnCurve: { difficultyBuffer: 0, maxActiveTiers: 2, peakPosition: 0.35, maxTier: 5 }
    }
    const queue = createSpawnQueue(42, config)
    let seed = 42
    for (const [index, entry] of queue.spawnQueue.entries()) {
      const expected = nextSpawnEntry(seed, 0, config, index + 1)
      expect(entry).toEqual(expected.entry)
      seed = expected.rngSeed
    }
    expect(queue.spawnQueue.some(entry => entry.kind === 'enemy' && entry.tier > 1)).toBe(true)
    const state = { ...createInitialState(42, config), turn: 100, enemyTierUnlockTurn: null }
    const refill = spawnNextMonster(state)
    expect(refill.spawnQueue.slice(0, -1)).toEqual(state.spawnQueue.slice(1))
    expect(refill.spawnQueue.at(-1)).toEqual(nextSpawnEntry(
      // The position selection consumes one RNG value before generating the entry.
      nextSeed(state.rngSeed), 0, config, state.turn + state.spawnQueue.length
    ).entry)
  })

  it('retires low tiers, keeps the maximum tier in the endgame, and handles no friendly spawns', () => {
    const config = DEFAULT_GAME_CONFIG
    const curve = { ...config.enemySpawnCurve!, friendlySpawnRate: config.friendSpawnChance }
    const turn = unlockTurn(1 + curve.maxActiveTiers, curve)
    for (let seed = 0; seed < 100; seed++) {
      const next = nextSpawnEntry(seed, 0, config, turn)
      if (next.entry.kind === 'enemy') expect(next.entry.tier).toBeGreaterThan(1)
      const late = nextSpawnEntry(seed, 0, config, unlockTurn(curve.maxTier + curve.maxActiveTiers, curve))
      if (late.entry.kind === 'enemy') expect(late.entry.tier).toBe(curve.maxTier)
      expect(nextSpawnEntry(seed, 0, { ...config, friendSpawnChance: 0 }, 100000).entry.tier).toBe(1)
    }
  })
})
