import { describe, expect, it } from 'vitest'
import { executeTurn } from '../game/engine'
import { createSpawnQueue } from '../game/spawning'
import type { Faction, GameState, Monster } from '../game/types'

function createMonster(
  id: string,
  faction: Faction,
  overrides: Partial<Monster> = {}
): Monster {
  return {
    id,
    faction,
    typeId: 'dragon',
    tier: 1,
    hp: 8,
    maxHp: 8,
    atk: 2,
    movable: false,
    ...overrides
  }
}

function createState(width: number, height: number, monsters: [number, Monster][]): GameState {
  const cells: GameState['cells'] = Array(width * height).fill(null)
  const spawnState = createSpawnQueue()
  for (const [index, monster] of monsters) {
    cells[index] = monster
  }

  return { width, height, cells, turn: 0, score: 0, gold: 0, xp: 0, enemyTierUnlockTurn: null, gameOver: false, ...spawnState }
}

describe('executeTurn combat', () => {
  it.each([
    ['right', 3, 4],
    ['left', 5, 4],
    ['down', 1, 4],
    ['up', 7, 4]
  ] as const)('allows stationary monsters to attack %s', (direction, attackerIndex, targetIndex) => {
    const state = createState(3, 3, [
      [attackerIndex, createMonster('player', 'player')],
      [targetIndex, createMonster('enemy', 'enemy')]
    ])

    const result = executeTurn(state, direction)

    expect(result.valid).toBe(true)
    expect(result.state.cells[targetIndex]?.hp).toBe(6)
    expect(result.events).toContainEqual({
      type: 'attack',
      attackerId: 'player',
      targetId: 'enemy',
      damage: 2
    })
    expect(result.state.turn).toBe(1)
  })

  it('resolves all active attacks before removing deaths', () => {
    const state = createState(3, 1, [
      [0, createMonster('player-a', 'player', { atk: 2 })],
      [1, createMonster('enemy', 'enemy', { hp: 1, atk: 2 })],
      [2, createMonster('player-b', 'player', { hp: 1 })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.events.filter(event => event.type === 'attack')).toHaveLength(2)
    expect(result.state.cells.some(monster => monster?.id === 'spawn-1')).toBe(true)
    expect(result.state.cells.filter(monster => monster && monster.id !== 'spawn-1').map(monster => monster.id))
      .toEqual(['player-a'])
    expect(result.events.filter(event => event.type === 'death')).toHaveLength(2)
  })

  it('does not let a monster counter after dying to an active attack', () => {
    const state = createState(3, 1, [
      [0, createMonster('player', 'player', { atk: 8 })],
      [1, createMonster('enemy', 'enemy', { hp: 4, atk: 5 })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.state.cells.some(monster => monster?.id === 'spawn-1')).toBe(true)
    expect(result.events.some(event => event.type === 'counter')).toBe(false)
  })

  it('lets surviving damaged defenders counter if they did not attack', () => {
    const state = createState(3, 1, [
      [0, createMonster('player', 'player', { atk: 3 })],
      [1, createMonster('enemy', 'enemy', { atk: 2 })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.state.cells[0]?.hp).toBe(6)
    expect(result.state.cells[1]?.hp).toBe(5)
    expect(result.stateAfterActiveAttacks?.cells[0]?.hp).toBe(8)
    expect(result.stateBeforeSpawn?.cells[0]?.hp).toBe(6)
    expect(result.events).toContainEqual({
      type: 'counter',
      attackerId: 'enemy',
      targetId: 'player',
      damage: 2
    })
  })

  it('does not counterattack an attacker that died in the active phase', () => {
    const state = createState(4, 1, [
      [0, createMonster('player-a', 'player', { atk: 2 })],
      [1, createMonster('enemy', 'enemy', { hp: 1, atk: 2 })],
      [2, createMonster('player-b', 'player')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.state.cells.some(monster => monster?.id === 'spawn-1')).toBe(true)
    expect(result.state.cells[2]?.hp).toBe(6)
    expect(result.events.some(event => event.type === 'counter')).toBe(false)
  })

  it('does not counter when the damaged defender made an active attack', () => {
    const state = createState(4, 1, [
      [0, createMonster('player-a', 'player', { atk: 1 })],
      [1, createMonster('enemy', 'enemy')],
      [2, createMonster('player-b', 'player')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.events).not.toContainEqual({
      type: 'counter',
      attackerId: 'enemy',
      targetId: 'player-a',
      damage: 2
    })
    expect(result.events).toContainEqual({
      type: 'counter',
      attackerId: 'player-b',
      targetId: 'enemy',
      damage: 2
    })
  })

  it('does not attack through a monster in the adjacent cell', () => {
    const state = createState(4, 1, [
      [0, createMonster('player-a', 'player')],
      [1, createMonster('player-b', 'player')],
      [2, createMonster('enemy', 'enemy')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.events).not.toContainEqual(expect.objectContaining({
      type: 'attack',
      attackerId: 'player-a'
    }))
  })

  it('makes an attack-only turn valid and rewards only defeated enemies', () => {
    const state = createState(2, 1, [
      [0, createMonster('player', 'player', { atk: 8 })],
      [1, createMonster('enemy', 'enemy', { hp: 4, atk: 1 })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.valid).toBe(true)
    expect(result.state).toMatchObject({
      turn: 1,
      score: 5,
      gold: 1,
      xp: 2
    })
    expect(result.events).toContainEqual({
      type: 'death',
      monsterId: 'enemy',
      at: 1
    })
  })

  it('adds tier-scaled scores for multiple enemy defeats without scaling gold or XP', () => {
    const state = createState(2, 2, [
      [0, createMonster('player-a', 'player', { atk: 10 })],
      [1, createMonster('enemy-a', 'enemy', { tier: 2, hp: 1 })],
      [2, createMonster('player-b', 'player', { atk: 10 })],
      [3, createMonster('enemy-b', 'enemy', { tier: 3, hp: 1 })]
    ])
    state.score = 7

    const result = executeTurn(state, 'right')

    expect(result.state).toMatchObject({ score: 67, gold: 2, xp: 4 })
  })

  it('uses the merged enemy tier for a counterattack defeat without rewarding the merge', () => {
    const state = createState(4, 1, [
      [0, createMonster('enemy-a', 'enemy', { movable: true })],
      [1, createMonster('enemy-b', 'enemy', { movable: true })],
      [3, createMonster('player', 'player', { atk: 16 })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.stateAfterMovement?.score).toBe(0)
    expect(result.events.some(event => event.type === 'merge')).toBe(true)
    expect(result.events.some(event => event.type === 'counter')).toBe(true)
    expect(result.state).toMatchObject({ score: 15, gold: 1, xp: 2 })
  })

  it('does not grant rewards for surviving enemies or defeated friendlies', () => {
    const survivingEnemy = createState(3, 1, [
      [0, createMonster('player', 'player')],
      [1, createMonster('enemy', 'enemy')]
    ])
    const defeatedFriendly = createState(3, 1, [
      [0, createMonster('player', 'player', { hp: 1, atk: 1 })],
      [1, createMonster('enemy', 'enemy', { atk: 2 })]
    ])
    defeatedFriendly.spawnQueue[0] = { kind: 'friend', typeId: 'dragon', tier: 1 }

    const survived = executeTurn(survivingEnemy, 'right')
    const friendlyDefeated = executeTurn(defeatedFriendly, 'right')

    expect(survived.state).toMatchObject({ score: 0, gold: 0, xp: 0 })
    expect(friendlyDefeated.state.cells.some(monster => monster?.id === 'spawn-1')).toBe(true)
    expect(friendlyDefeated.state.gameOver).toBe(false)
    expect(friendlyDefeated.state).toMatchObject({ score: 0, gold: 0, xp: 0 })
  })
})
