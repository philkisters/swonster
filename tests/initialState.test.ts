import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '../game/config'
import { createInitialState } from '../game/initialState'
import { chooseRunSeed } from '../game/rng'

describe('createInitialState', () => {
  it('creates a 4×4 board with the configured starting monster counts', () => {
    const state = createInitialState()
    const startingMonsters = state.cells.filter((monster): monster is NonNullable<typeof monster> => monster !== null)

    expect(state).toMatchObject({ width: 4, height: 4, turn: 0 })
    expect(state.cells).toHaveLength(16)
    expect(startingMonsters).toHaveLength(2)
    expect(startingMonsters.filter(monster => monster.faction === 'player')).toHaveLength(1)
    expect(startingMonsters.filter(monster => monster.faction === 'enemy')).toHaveLength(1)
    expect(state.spawnQueue).toHaveLength(10)
  })

  it('places configured starting monsters deterministically from the run seed', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      startingPlayerMonsterCount: 3,
      startingEnemyMonsterCount: 5,
      playerMonsterTypes: ['griffin']
    }
    const first = createInitialState(42, config)
    const repeated = createInitialState(42, config)
    const otherSeed = createInitialState(43, config)
    const startingMonsters = first.cells.flatMap((monster, index) => monster ? [{ ...monster, index }] : [])

    expect(first.cells).toEqual(repeated.cells)
    expect(first.cells).not.toEqual(otherSeed.cells)
    expect(startingMonsters).toHaveLength(8)
    expect(startingMonsters.filter(monster => monster.faction === 'player')).toHaveLength(3)
    expect(startingMonsters.filter(monster => monster.faction === 'enemy')).toHaveLength(5)
    expect(startingMonsters.filter(monster => monster.faction === 'player').every(monster => monster.typeId === 'griffin')).toBe(true)
    expect(new Set(startingMonsters.map(monster => monster.index)).size).toBe(8)
  })

  it.each([[3, 4], [4, 3]] as const)('supports rectangular %i×%i boards', (boardWidth, boardHeight) => {
    const state = createInitialState(42, {
      ...DEFAULT_GAME_CONFIG,
      boardWidth,
      boardHeight
    })

    expect(state).toMatchObject({ width: boardWidth, height: boardHeight })
    expect(state.cells).toHaveLength(boardWidth * boardHeight)
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
