import { describe, expect, it } from 'vitest'
import { executeTurn } from '../game/engine'
import { getHealthChanges } from '../game/healthChanges'
import { createRock, ROCK_HITS } from '../game/obstacles'
import { createSpawnQueue } from '../game/spawning'
import { createSpellSlots } from '../game/spellSlots'
import { castSpell, SPELLS } from '../game/spells'
import { getTargetOptions } from '../game/targeting'
import type { Target } from '../game/targeting'
import type { Faction, GameEvent, GameState, Monster, SpellId } from '../game/types'

function createMonster(id: string, faction: Faction, overrides: Partial<Monster> = {}): Monster {
  return { id, faction, typeId: 'dragon', tier: 1, hp: 8, maxHp: 8, atk: 2, movable: true, ...overrides }
}

function createState(width: number, height: number, pieces: [number, Monster][], spellId: SpellId | null = null): GameState {
  const cells: GameState['cells'] = Array(width * height).fill(null)
  for (const [index, piece] of pieces) {
    cells[index] = piece
  }

  return {
    width,
    height,
    cells,
    turn: 0,
    score: 0,
    gold: 100,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...createSpawnQueue(42),
    ...createSpellSlots(42),
    spellSlots: [spellId, null, null, null]
  }
}

const cell = (index: number): Target => ({ shape: 'cell', index })

describe('rock spell', () => {
  it('costs 1 gold and places an undamaged rock on a free cell', () => {
    const state = createState(3, 1, [[0, createMonster('ally', 'player')]], 'rock')

    const result = castSpell(state, 0, [cell(2)])

    expect(SPELLS.rock.cost).toBe(1)
    expect(result.valid).toBe(true)
    expect(result.state.gold).toBe(99)
    expect(result.state.cells[2]).toMatchObject({ faction: 'neutral', typeId: 'rock', hp: ROCK_HITS, movable: false })
  })

  it('cannot be placed on an occupied cell', () => {
    const state = createState(3, 1, [[0, createMonster('ally', 'player')], [1, createRock('rock')]], 'rock')

    expect(castSpell(state, 0, [cell(0)]).valid).toBe(false)
    expect(castSpell(state, 0, [cell(1)]).valid).toBe(false)
  })
})

describe('rocks on the board', () => {
  it('stays put and blocks monsters of both factions', () => {
    const state = createState(5, 1, [
      [0, createMonster('ally', 'player')],
      [2, createRock('rock')],
      [4, createMonster('enemy', 'enemy')]
    ])

    const right = executeTurn(state, 'right')
    const left = executeTurn(state, 'left')

    expect(right.state.cells[1]?.id).toBe('ally')
    expect(right.state.cells[2]?.id).toBe('rock')
    expect(left.state.cells[2]?.id).toBe('rock')
    expect(left.state.cells[3]?.id).toBe('enemy')
  })

  it('takes one crack from any monster swiped against it, whatever its attack', () => {
    const state = createState(4, 1, [
      [0, createMonster('ally', 'player', { atk: 50 })],
      [3, createRock('rock')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.state.cells[3]).toMatchObject({ id: 'rock', hp: ROCK_HITS - 1 })
    expect(result.events).toContainEqual({ type: 'attack', attackerId: 'ally', targetId: 'rock', damage: 1 })
    expect(result.state).toMatchObject({ score: 0, gold: 100, xp: 0 })
  })

  it('cracks when a monster that cannot move is swiped against it, which makes the turn valid', () => {
    const state = createState(2, 1, [[0, createMonster('enemy', 'enemy')], [1, createRock('rock')]])

    const result = executeTurn(state, 'right')

    expect(result.valid).toBe(true)
    expect(result.state.turn).toBe(1)
    expect(result.state.cells[1]?.hp).toBe(ROCK_HITS - 1)
  })

  it('is left alone by swipes that push no monster against it', () => {
    const state = createState(2, 1, [[0, createMonster('ally', 'player')], [1, createRock('rock')]])

    expect(executeTurn(state, 'left').valid).toBe(false)
  })

  it(`cracks further with every hit and breaks on hit ${ROCK_HITS}, freeing its cell`, () => {
    let state = createState(3, 3, [[4, createMonster('ally', 'player')], [5, createRock('rock')]])
    state.spawnQueue = state.spawnQueue.map(() => ({ kind: 'friend', typeId: 'griffin', tier: 1 }))
    const hitsLeft: (number | null)[] = []
    let events: GameEvent[] = []

    for (let hit = 0; hit < ROCK_HITS; hit++) {
      const result = executeTurn(state, 'right')
      hitsLeft.push(result.stateBeforeSpawn?.cells[5]?.hp ?? null)
      events = result.events
      state = result.state
    }

    expect(hitsLeft).toEqual([4, 3, 2, 1, null])
    expect(events).toContainEqual({ type: 'death', monsterId: 'rock', at: 5 })
  })

  it('neither attacks nor counters', () => {
    const state = createState(3, 1, [
      [0, createRock('left')],
      [1, createMonster('ally', 'player')],
      [2, createRock('right')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.events.filter(event => event.type === 'attack' || event.type === 'counter')).toEqual([
      { type: 'attack', attackerId: 'ally', targetId: 'right', damage: 1 }
    ])
    expect(result.state.cells[1]?.hp).toBe(8)
  })

  it('does not keep a monster pushed against it from countering', () => {
    const state = createState(3, 1, [
      [0, createMonster('enemy', 'enemy')],
      [1, createMonster('ally', 'player')],
      [2, createRock('rock')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.events).toContainEqual({ type: 'counter', attackerId: 'ally', targetId: 'enemy', damage: 2 })
    expect(result.state.cells[2]?.hp).toBe(ROCK_HITS - 1)
  })

  it('counts as an occupied cell for spawning and the full board', () => {
    const state = createState(2, 1, [[0, createMonster('ally', 'player')], [1, createRock('rock')]])

    const result = executeTurn(state, 'right')

    expect(result.state).toMatchObject({ gameOver: true, gameOverReason: 'board-full' })
  })

  it('cannot be targeted or damaged by spells', () => {
    const pieces: [number, Monster][] = [[0, createRock('rock')], [1, createMonster('enemy', 'enemy')]]
    const barrage = castSpell(createState(3, 1, pieces, 'fireballBarrage'), 0, [{ shape: 'row', index: 0 }])

    for (const spellId of ['fireball', 'superMove', 'superSwap', 'freeze'] as const) {
      const options = getTargetOptions(createState(3, 1, pieces, spellId), SPELLS[spellId].targets)

      expect(options).not.toContainEqual(cell(0))
    }
    expect(barrage.state.cells[0]).toMatchObject({ id: 'rock', hp: ROCK_HITS })
  })

  it('shows no health popup for its damage', () => {
    const state = createState(2, 1, [[0, createMonster('ally', 'player')], [1, createRock('rock')]])

    expect(getHealthChanges(state.cells, executeTurn(state, 'right').state.cells)).toEqual([])
  })
})
