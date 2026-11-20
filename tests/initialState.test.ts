import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '../game/config'
import { createInitialState } from '../game/initialState'
import { chooseRunSeed } from '../game/rng'

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

  it('uses fixed seeds, including zero, without drawing a random seed', () => {
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues')
    try {
      const config = { ...DEFAULT_GAME_CONFIG, rngSeed: 0 }
      expect(chooseRunSeed(config.rngSeed)).toBe(0)
      expect(createInitialState(undefined, config)).toEqual(createInitialState(0, config))
      expect(random).not.toHaveBeenCalled()
    } finally {
      random.mockRestore()
    }
  })

  it('draws one seed per random run and uses it for both spawn and spell streams', () => {
    let next = 41
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((values) => {
      if (!(values instanceof Uint32Array)) throw new Error('Expected a Uint32Array')
      values[0] = ++next
      return values
    })
    try {
      const first = createInitialState()
      const second = createInitialState()
      expect(first).toEqual(createInitialState(42))
      expect(second).toEqual(createInitialState(43))
      expect(random).toHaveBeenCalledTimes(2)
    } finally {
      random.mockRestore()
    }
  })
})
