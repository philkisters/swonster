import { describe, expect, it } from 'vitest'
import { getMonsterStats } from '../game/config'
import { executeTurn } from '../game/engine'
import { createSpawnQueue } from '../game/spawning'
import { createSpellSlots } from '../game/spellSlots'
import type { Faction, GameState, Monster } from '../game/types'

function createMonster(
  id: string,
  faction: Faction = 'player',
  tier = 1,
  overrides: Partial<Monster> = {}
): Monster {
  const stats = getMonsterStats('dragon', tier)

  return {
    id,
    faction,
    typeId: 'dragon',
    tier,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    movable: true,
    ...overrides
  }
}

function createState(width: number, height: number, monsters: [number, Monster][]): GameState {
  const cells: GameState['cells'] = Array(width * height).fill(null)
  const spawnState = createSpawnQueue()
  for (const [index, monster] of monsters) {
    cells[index] = monster
  }

  return { width, height, cells, turn: 0, score: 0, gold: 0, xp: 0, enemyTierUnlockTurn: null, gameOver: false, ...spawnState, ...createSpellSlots() }
}

describe('executeTurn movement and merging', () => {
  it.each([
    ['left', 3, 5, 3, 4],
    ['right', 5, 3, 5, 4],
    ['up', 1, 7, 1, 4],
    ['down', 7, 1, 7, 4]
  ] as const)(
    'slides both factions %s without passing opposing monsters',
    (direction, playerStart, enemyStart, playerEnd, enemyEnd) => {
      const state = createState(3, 3, [
        [playerStart, createMonster('player')],
        [enemyStart, createMonster('enemy', 'enemy')]
      ])

      const result = executeTurn(state, direction)

      expect(result.valid).toBe(true)
      expect(result.state.cells[playerEnd]?.id).toBe('player')
      expect(result.state.cells[enemyEnd]?.id).toBe('enemy')
      expect(result.state.cells.filter(monster => monster && !monster.id.startsWith('spawn-'))).toHaveLength(2)
      expect(result.state.turn).toBe(1)
    }
  )

  it('moves a stationary monster neither through nor out of its cell', () => {
    const state = createState(5, 1, [
      [0, createMonster('mover')],
      [2, createMonster('stationary', 'player', 1, { movable: false })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.state.cells[1]?.id).toBe('mover')
    expect(result.state.cells[2]?.id).toBe('stationary')
    expect(result.events.filter(event => event.type === 'spawn')).toHaveLength(1)
    expect(result.state.cells.filter(monster => monster?.id.startsWith('spawn-'))).toHaveLength(1)
  })

  it('restores HP on merge and prevents the result from merging again this turn', () => {
    const state = createState(5, 1, [
      [0, createMonster('first', 'player', 1, { hp: 1 })],
      [1, createMonster('second')],
      [2, createMonster('tier-two', 'player', 2)]
    ])

    const result = executeTurn(state, 'left')
    const merged = result.state.cells[0]

    expect(merged).toMatchObject({
      faction: 'player',
      typeId: 'dragon',
      tier: 2,
      hp: merged?.maxHp
    })
    expect(result.state.cells[1]?.id).toBe('tier-two')
    expect(result.events.filter(event => event.type === 'merge')).toHaveLength(1)
  })

  it.each([
    [1, 3],
    [2, 6],
    [3, 12]
  ])('rewards a friendly tier %i merge with %i score', (tier, score) => {
    const state = createState(2, 1, [
      [0, createMonster('first', 'player', tier)],
      [1, createMonster('second', 'player', tier)]
    ])
    state.score = 10

    const result = executeTurn(state, 'left')

    expect(result.state.score).toBe(10 + score)
    expect(result.stateAfterMovement?.score).toBe(10 + score)
    expect(result.stateAfterActiveAttacks?.score).toBe(10 + score)
    expect(result.state).toMatchObject({ gold: 0, xp: 0 })
  })

  it('adds rewards for multiple friendly merges but not enemy merges', () => {
    const state = createState(2, 3, [
      [0, createMonster('player-a')],
      [1, createMonster('player-b')],
      [2, createMonster('player-c', 'player', 2)],
      [3, createMonster('player-d', 'player', 2)],
      [4, createMonster('enemy-a', 'enemy')],
      [5, createMonster('enemy-b', 'enemy')]
    ])

    const result = executeTurn(state, 'left')

    expect(result.events.filter(event => event.type === 'merge')).toHaveLength(3)
    expect(result.state.score).toBe(9)
  })

  it('exposes merged monsters before combat for the merge animation', () => {
    const state = createState(4, 1, [
      [0, createMonster('first')],
      [1, createMonster('second')],
      [3, createMonster('enemy', 'enemy')]
    ])

    const base = getMonsterStats('dragon', 1)
    const merged = getMonsterStats('dragon', 2)

    const result = executeTurn(state, 'right')

    expect(result.stateAfterMovement?.cells[2]).toMatchObject({ tier: 2, hp: merged.maxHp })
    expect(result.stateAfterMovement?.cells[3]?.hp).toBe(base.maxHp)
    expect(result.stateAfterActiveAttacks?.cells[3]?.hp).toBe(base.maxHp - merged.atk)
    expect(result.stateAfterMovement?.turn).toBe(1)
  })

  it('combines friendly merge and enemy defeat scores in the same turn', () => {
    const state = createState(4, 1, [
      [0, createMonster('first')],
      [1, createMonster('second')],
      [3, createMonster('enemy', 'enemy', 1, { hp: 1, movable: false })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.stateAfterMovement?.score).toBe(3)
    expect(result.state.score).toBe(8)
    expect(result.state).toMatchObject({ gold: 1, xp: 2 })
  })

  it('does not merge different factions, types, or tiers', () => {
    const state = createState(5, 1, [
      [0, createMonster('player')],
      [1, createMonster('enemy', 'enemy')],
      [2, { ...createMonster('other-type'), typeId: 'griffin' }],
      [3, createMonster('tier-two', 'player', 2)]
    ])

    const result = executeTurn(state, 'left')

    expect(result.events.some(event => event.type === 'merge')).toBe(false)
  })

  it('preserves the original state on an inactive swipe', () => {
    const state = createState(5, 1, [[4, createMonster('edge')]])

    const result = executeTurn(state, 'right')

    expect(result).toEqual({ state, events: [], valid: false })
    expect(result.state).toBe(state)
  })
})
