import {
  DEFAULT_GAME_CONFIG,
  DEFAULT_RNG_SEED,
  getMonsterDefinition,
  getMonsterStats,
  getMonsterTypeIds
} from './config'
import type { GameConfig } from './config'
import { nextSeed } from './rng'
import { pickEnemyTier } from './spawn'
import type { GameEvent, GameState, Monster, SpawnEntry, SpawnKind } from './types'

export function nextSpawnEntry(seed: number, turnsSinceUnlock = 0, config: GameConfig = DEFAULT_GAME_CONFIG, spawnTurn = 0): { entry: SpawnEntry, rngSeed: number } {
  let rngSeed = nextSeed(seed)
  const kind: SpawnKind = rngSeed / 0x100000000 < config.friendSpawnChance ? 'friend' : 'enemy'
  rngSeed = nextSeed(rngSeed)
  const faction = kind === 'friend' ? 'player' : 'enemy'
  const typeIds = getMonsterTypeIds(faction, config)
  const typeIndex = Math.floor(rngSeed / 0x100000000 * typeIds.length)
  const typeId = typeIds[typeIndex]
  if (!typeId) {
    throw new Error(`Cannot generate a ${faction} spawn without configured monster types`)
  }

  let tier: number = config.spawnTier
  if (kind === 'enemy' && config.enemySpawnCurve) {
    rngSeed = nextSeed(rngSeed)
    tier = pickEnemyTier(spawnTurn, {
      ...config.enemySpawnCurve,
      friendlySpawnRate: config.friendSpawnChance
    }, () => rngSeed / 0x100000000)
  } else if (kind === 'enemy' && turnsSinceUnlock > 0) {
    if (!config.enemyTierProgression) {
      throw new Error('Enemy tier progression is required without an enemy spawn curve')
    }
    rngSeed = nextSeed(rngSeed)
    const roll = rngSeed / 0x100000000
    let threshold = 0
    for (const progression of config.enemyTierProgression) {
      threshold += Math.min(turnsSinceUnlock * progression.chancePerTurn, progression.maxChance)
      if (roll < threshold) {
        tier = progression.tier
        break
      }
    }
  }

  return {
    entry: {
      kind,
      typeId,
      tier
    },
    rngSeed
  }
}

export function createSpawnQueue(seed = DEFAULT_RNG_SEED, config: GameConfig = DEFAULT_GAME_CONFIG): {
  spawnQueue: SpawnEntry[]
  rngSeed: number
} {
  const spawnQueue: SpawnEntry[] = []
  let rngSeed = seed >>> 0

  for (let index = 0; index < config.spawnQueueLength; index++) {
    const next = nextSpawnEntry(rngSeed, 0, config, index + 1)
    spawnQueue.push(next.entry)
    rngSeed = next.rngSeed
  }

  return { spawnQueue, rngSeed }
}

export function spawnNextMonster(state: GameState): {
  cells: GameState['cells']
  spawnQueue: SpawnEntry[]
  rngSeed: number
  event: Extract<GameEvent, { type: 'spawn' }>
} {
  const entry = state.spawnQueue[0]
  if (!entry) {
    throw new Error('Cannot spawn a monster without a spawn queue entry')
  }
  const definition = getMonsterDefinition(entry.typeId, state.config)
  const expectedFaction = entry.kind === 'friend' ? 'player' : 'enemy'
  if (definition.faction !== expectedFaction) {
    throw new Error(`Monster type ${entry.typeId} cannot spawn for faction ${expectedFaction}`)
  }

  const freeIndices = state.cells.flatMap((monster, index) => monster === null ? [index] : [])
  if (freeIndices.length === 0) {
    throw new Error('Cannot spawn a monster: the board has no free cell')
  }
  const positionSeed = nextSeed(state.rngSeed)
  const at = freeIndices[Math.floor(positionSeed / 0x100000000 * freeIndices.length)]
  if (at === undefined) {
    throw new Error('Cannot select a free cell for the spawn')
  }

  const stats = getMonsterStats(entry.typeId, entry.tier, state.config)
  const monster: Monster = {
    id: `spawn-${state.turn}`,
    faction: definition.faction,
    typeId: entry.typeId,
    tier: entry.tier,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    movable: true,
    ...(entry.kind === 'boss' ? { isBoss: true } : {})
  }
  const cells = [...state.cells]
  cells[at] = monster
  const turnsSinceUnlock = state.enemyTierUnlockTurn === null
    ? 0
    : state.turn - state.enemyTierUnlockTurn
  const next = nextSpawnEntry(positionSeed, turnsSinceUnlock, state.config, state.turn + state.spawnQueue.length)

  return {
    cells,
    spawnQueue: [...state.spawnQueue.slice(1), next.entry],
    rngSeed: next.rngSeed,
    event: { type: 'spawn', monsterId: monster.id, at, kind: entry.kind }
  }
}
