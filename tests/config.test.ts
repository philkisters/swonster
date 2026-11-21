import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, getMonsterHeadSprite, getMonsterSprite } from '../game/config'
import { isGameConfig, parseAvailableConfig } from '../game/configValidation'
import { createInitialState } from '../game/initialState'
import { slideAndMerge } from '../game/movement'
import { nextSpawnEntry } from '../game/spawning'
import { gameStateSchema } from '../game/stateValidation'

describe('monster sprites', () => {
  it.each([
    ['dragon', '/sprites/dragon-level-1.png'],
    ['griffin', '/sprites/griffin-level-5.png'],
    ['skeletDragon', '/sprites/skeleton-dragon-level-10.png']
  ] as const)('uses the sprite for the monster type and level', (typeId, expected) => {
    const tier = Number(expected.match(/level-(\d+)/)![1])

    expect(getMonsterSprite(typeId, tier)).toBe(expected)
  })

  describe('published configurations', () => {
    it('validates required rules, probabilities, and starting monster factions', () => {
      expect(isGameConfig(DEFAULT_GAME_CONFIG)).toBe(true)
      const { playerMonsterTypes: _, ...legacyRules } = DEFAULT_GAME_CONFIG
      expect(isGameConfig(legacyRules)).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, rngSeed: 0 })).toBe(true)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, rngSeed: -1 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, rngSeed: 0x100000000 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, spellRefillInterval: 0 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, boardWidth: 3 })).toBe(true)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, boardHeight: 3 })).toBe(true)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, boardWidth: 2 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, boardHeight: 2 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, startingPlayerMonsterCount: 0 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, startingEnemyMonsterCount: -1 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, startingPlayerMonsterCount: 16, startingEnemyMonsterCount: 1 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, playerMonsterTypes: [] })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, playerMonsterTypes: ['skeletDragon'] })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, playerMonsterTypes: ['dragon', 'dragon'] })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, enemyTierProgression: [
        { tier: 2, chancePerTurn: 0.1, maxChance: 0.8 },
        { tier: 3, chancePerTurn: 0.1, maxChance: 0.8 }
      ] })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, monsterTypes: {
        ...DEFAULT_GAME_CONFIG.monsterTypes,
        dragon: { ...DEFAULT_GAME_CONFIG.monsterTypes.dragon, faction: 'enemy' }
      } })).toBe(false)
      expect(() => parseAvailableConfig('broken', { name: 'Broken', rules: {} })).toThrow('broken')
    })

    it('reports the field responsible for an invalid published config', () => {
      expect(() => parseAvailableConfig('bad-board', {
        name: 'Bad board',
        rules: { ...DEFAULT_GAME_CONFIG, boardWidth: 2 }
      })).toThrow(/bad-board.*rules\.boardWidth/)
      expect(() => parseAvailableConfig('bad-faction', {
        name: 'Bad faction',
        rules: {
          ...DEFAULT_GAME_CONFIG,
          monsterTypes: {
            ...DEFAULT_GAME_CONFIG.monsterTypes,
            dragon: { ...DEFAULT_GAME_CONFIG.monsterTypes.dragon!, faction: 'enemy' }
          }
        }
      })).toThrow(/rules\.monsterTypes\.dragon/)
    })

    it('validates archive status while allowing older configs without it', () => {
      expect(parseAvailableConfig('old', { name: 'Old', rules: DEFAULT_GAME_CONFIG }).archived).toBeUndefined()
      const { playerMonsterTypes: _playerMonsterTypes, ...legacyRules } = DEFAULT_GAME_CONFIG
      const parsedLegacyRules = parseAvailableConfig('legacy-rules', { name: 'Legacy rules', rules: legacyRules }).rules
      expect(parsedLegacyRules.playerMonsterTypes).toEqual(['dragon', 'griffin'])
      expect(parsedLegacyRules.startingPlayerMonsterCount).toBe(1)
      expect(parsedLegacyRules.startingEnemyMonsterCount).toBe(1)
      expect(parseAvailableConfig('archived', { name: 'Archived', rules: DEFAULT_GAME_CONFIG, archived: true }).archived).toBe(true)
      expect(() => parseAvailableConfig('invalid', { name: 'Invalid', rules: DEFAULT_GAME_CONFIG, archived: 'true' }))
        .toThrow(/archived/)
    })

    it('defaults legacy spell settings and validates configured spell lists and costs', () => {
      const { availableSpells: _spells, spellCostModifier: _modifier, ...legacyRules } = DEFAULT_GAME_CONFIG
      const rules = parseAvailableConfig('legacy-spells', { name: 'Legacy', rules: legacyRules }).rules
      expect(rules.availableSpells).toEqual(DEFAULT_GAME_CONFIG.availableSpells)
      expect(rules.spellCostModifier).toBe(1)
      const state = createInitialState(42)
      expect(gameStateSchema.parse({ ...state, config: legacyRules }).config).toMatchObject({
        availableSpells: DEFAULT_GAME_CONFIG.availableSpells,
        spellCostModifier: 1
      })
      expect(isGameConfig(legacyRules)).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, availableSpells: [] })).toBe(true)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, availableSpells: ['unknown'] })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, availableSpells: ['heal', 'heal'] })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, spellCostModifier: 0 })).toBe(true)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, spellCostModifier: -1 })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, spellCostModifier: Infinity })).toBe(false)
    })

    it('rejects non-finite numbers and preserves additional fields in valid rules', () => {
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, friendSpawnChance: Infinity })).toBe(false)
      expect(isGameConfig({ ...DEFAULT_GAME_CONFIG, rngSeed: '2048' })).toBe(false)
      const rules = { ...DEFAULT_GAME_CONFIG, futureField: 'kept' }
      expect(parseAvailableConfig('extra', { name: 'Extra', rules }).rules).toMatchObject({
        futureField: 'kept'
      })
    })

    it('uses the selected rules for setup, spawning and merging without changing defaults', () => {
      const config = {
        ...DEFAULT_GAME_CONFIG,
        boardWidth: 5,
        rngSeed: 42,
        friendSpawnChance: 1,
        friendlyMergeScore: 50,
        startingPlayerMonsterCount: 2,
        startingEnemyMonsterCount: 0,
        playerMonsterTypes: ['griffin'],
        monsterTypes: {
          ...DEFAULT_GAME_CONFIG.monsterTypes,
          griffin: { ...DEFAULT_GAME_CONFIG.monsterTypes.griffin!, baseMaxHp: 20 }
        }
      }
      const state = createInitialState(undefined, config)
      expect(state.width).toBe(5)
      const playerMonsters = state.cells.filter(monster => monster?.faction === 'player')
      expect(playerMonsters).toHaveLength(2)
      expect(playerMonsters.every(monster => monster.typeId === 'griffin' && monster.maxHp === 20)).toBe(true)
      expect(state.spawnQueue.every(entry => entry.kind === 'friend')).toBe(true)
      expect(nextSpawnEntry(42, 0, config).entry.kind).toBe('friend')
      const playerMonster = playerMonsters[0]
      if (!playerMonster) throw new Error('Expected starting player monsters')
      const mergeCells: typeof state.cells = Array(state.cells.length).fill(null)
      mergeCells[0] = playerMonster
      mergeCells[1] = { ...playerMonster, id: 'merge-test' }
      const result = slideAndMerge({ ...state, cells: mergeCells }, 'left')
      expect(result.score).toBe(50)
      expect(result.cells[0]?.maxHp).toBe(40)
      expect(DEFAULT_GAME_CONFIG.monsterTypes.griffin?.baseMaxHp).toBe(6)
    })

    it.each(['dragon', 'griffin'] as const)('limits player monsters to configured type %s', (typeId) => {
      const config = {
        ...DEFAULT_GAME_CONFIG,
        friendSpawnChance: 1,
        playerMonsterTypes: [typeId]
      }
      const state = createInitialState(42, config)
      const initialPlayerTypes = state.cells.flatMap(monster => monster?.faction === 'player' ? [monster.typeId] : [])

      expect(initialPlayerTypes.length).toBeGreaterThan(0)
      expect(initialPlayerTypes.every(id => id === typeId)).toBe(true)
      expect(state.spawnQueue.every(entry => entry.typeId === typeId)).toBe(true)
      expect(nextSpawnEntry(42, 0, config).entry.typeId).toBe(typeId)
    })
  })

  it('caps levels above ten at the final sprite', () => {
    expect(getMonsterSprite('dragon', 11)).toBe('/sprites/dragon-level-10.png')
    expect(getMonsterSprite('griffin', 100)).toBe('/sprites/griffin-level-10.png')
    expect(getMonsterSprite('skeletDragon', 20)).toBe('/sprites/skeleton-dragon-level-10.png')
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid level %s', (tier) => {
    expect(() => getMonsterSprite('dragon', tier)).toThrow('Invalid monster tier')
    expect(() => getMonsterHeadSprite('dragon', tier)).toThrow('Invalid monster tier')
  })

  it('uses the head portrait matching the full sprite', () => {
    expect(getMonsterHeadSprite('griffin', 3)).toBe('/sprites/heads/griffin-level-3.png')
    expect(getMonsterHeadSprite('skeletDragon', 20)).toBe('/sprites/heads/skeleton-dragon-level-10.png')
  })
})
