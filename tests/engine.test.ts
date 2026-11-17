import { describe, expect, it } from 'vitest'
import { createSpawnQueue } from '../game/spawning'
import { executeTurn } from '../game/engine'
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

function createState(monsters: [number, Monster][]): GameState {
  const cells: GameState['cells'] = Array(2).fill(null)
  const spawnState = createSpawnQueue(42)
  for (const [index, monster] of monsters) {
    cells[index] = monster
  }

  return {
    width: 2,
    height: 1,
    cells,
    turn: 0,
    score: 0,
    gold: 0,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...spawnState
  }
}

describe('game-over conditions', () => {
  it('spawns normally when the last friendly monster dies', () => {
    const state = createState([
      [0, createMonster('enemy', 'enemy')],
      [1, createMonster('player', 'player', { hp: 1 })]
    ])
    state.spawnQueue[0] = { kind: 'friend', typeId: 'dragon', tier: 1 }

    const result = executeTurn(state, 'right')

    expect(result).toMatchObject({
      valid: true,
      state: {
        turn: 1,
        gameOver: false
      }
    })
    expect(result.state.cells[1]).toMatchObject({ id: 'spawn-1', faction: 'player' })
    expect(result.events.some(event => event.type === 'gameOver')).toBe(false)
  })

  it.each(['enemy', 'boss'] as const)(
    'ends after spawning a %s when no friendly monsters remain',
    (kind) => {
      const state = createState([
        [0, createMonster('enemy', 'enemy')],
        [1, createMonster('player', 'player', { hp: 1 })]
      ])
      state.width = 3
      state.cells.push(null)
      state.spawnQueue[0] = { kind, typeId: 'skeletDragon', tier: 1 }
      const originalQueue = [...state.spawnQueue]
      const originalSeed = state.rngSeed

      const result = executeTurn(state, 'right')

      expect(result.valid).toBe(true)
      expect(result.state).toMatchObject({
        turn: 1,
        gameOver: true,
        gameOverReason: 'no-friendly-monsters'
      })
      expect(result.state.cells.find(monster => monster?.id === 'spawn-1'))
        .toMatchObject({ faction: 'enemy' })
      expect(result.state.cells).toContain(null)
      expect(result.state.spawnQueue.slice(0, 9)).toEqual(originalQueue.slice(1))
      expect(result.state.rngSeed).not.toBe(originalSeed)
      expect(result.events.at(-2)).toMatchObject({ type: 'spawn', kind })
      expect(result.events.at(-1)).toEqual({ type: 'gameOver', reason: 'no-friendly-monsters' })
      expect(executeTurn(result.state, 'left')).toEqual({ state: result.state, events: [], valid: false })
    }
  )

  it('ends without spawning when combat leaves the board full', () => {
    const state = createState([
      [0, createMonster('player', 'player')],
      [1, createMonster('enemy', 'enemy')]
    ])

    const result = executeTurn(state, 'right')

    expect(result.state.gameOver).toBe(true)
    expect(result.state.gameOverReason).toBe('board-full')
    expect(result.state.spawnQueue).toBe(state.spawnQueue)
    expect(result.state.rngSeed).toBe(state.rngSeed)
    expect(result.state.turn).toBe(1)
    expect(result.events.some(event => event.type === 'spawn')).toBe(false)
    expect(result.events.at(-1)).toEqual({ type: 'gameOver', reason: 'board-full' })
  })

  it('continues when a valid spawn fills the final free cell', () => {
    const state = createState([
      [0, createMonster('player', 'player', { movable: true })]
    ])
    state.spawnQueue[0] = { kind: 'enemy', typeId: 'skeletDragon', tier: 1 }

    const result = executeTurn(state, 'right')

    expect(result.state.gameOver).toBe(false)
    expect(result.state.cells.every(monster => monster !== null)).toBe(true)
    expect(result.state.spawnQueue.slice(0, 9)).toEqual(state.spawnQueue.slice(1))
    expect(result.events.at(-1)?.type).toBe('spawn')
    expect(result.events.some(event => event.type === 'gameOver')).toBe(false)

    const nextTurn = executeTurn(result.state, 'right')

    expect(nextTurn.valid).toBe(true)
    expect(nextTurn.state.gameOverReason).toBe('board-full')
    expect(nextTurn.state.turn).toBe(2)
    expect(nextTurn.state.spawnQueue).toBe(result.state.spawnQueue)
    expect(nextTurn.events.at(-1)).toEqual({ type: 'gameOver', reason: 'board-full' })
  })

  it('allows a full board to merge before the next spawn', () => {
    const state = createState([
      [0, createMonster('player-a', 'player', { movable: true })],
      [1, createMonster('player-b', 'player', { movable: true })]
    ])

    const result = executeTurn(state, 'right')

    expect(result.valid).toBe(true)
    expect(result.state.gameOver).toBe(false)
    expect(result.events.some(event => event.type === 'merge')).toBe(true)
    expect(result.events.at(-1)?.type).toBe('spawn')
    expect(result.state.cells.every(monster => monster !== null)).toBe(true)
  })

  it('does not attempt a spawn or end the game for an inactive swipe on a full board', () => {
    const state = createState([
      [0, createMonster('player', 'player')],
      [1, createMonster('enemy', 'enemy')]
    ])

    const result = executeTurn(state, 'up')

    expect(result).toEqual({ state, events: [], valid: false })
  })

  it('does not process another turn after game over', () => {
    const state = {
      ...createState([]),
      gameOver: true,
      gameOverReason: 'board-full' as const
    }

    const result = executeTurn(state, 'left')

    expect(result).toEqual({ state, events: [], valid: false })
  })
})
