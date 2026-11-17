import { describe, expect, it } from 'vitest'
import { createInitialState } from '../game/initialState'

describe('createInitialState', () => {
  it('creates a 4×4 board with the specified friendly and enemy monsters', () => {
    const state = createInitialState()

    expect(state).toMatchObject({ width: 4, height: 4, turn: 0 })
    expect(state.cells).toHaveLength(16)
    expect(state.cells.flatMap((monster, index) => {
      if (!monster) return []

      return [{
        index,
        faction: monster.faction,
        typeId: monster.typeId
      }]
    })).toEqual([
      { index: 3, faction: 'enemy', typeId: 'skeletDragon' },
      { index: 4, faction: 'player', typeId: 'dragon' },
      { index: 5, faction: 'enemy', typeId: 'skeletDragon' },
      { index: 6, faction: 'enemy', typeId: 'skeletDragon' },
      { index: 7, faction: 'enemy', typeId: 'skeletDragon' },
      { index: 8, faction: 'enemy', typeId: 'skeletDragon' },
      { index: 12, faction: 'player', typeId: 'griffin' },
      { index: 14, faction: 'player', typeId: 'griffin' }
    ])
    expect(state.spawnQueue).toHaveLength(10)
  })

  it('creates the same spawn preview and seed for the same run seed', () => {
    expect(createInitialState(42).spawnQueue).toEqual(createInitialState(42).spawnQueue)
    expect(createInitialState(42).rngSeed).toBe(createInitialState(42).rngSeed)
  })
})
