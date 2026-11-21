import type { Faction } from './types'
import type { GameConfig, MonsterTypeDefinition } from './configValidation'

export type { GameConfig, MonsterTypeDefinition } from './configValidation'

export const MAX_MONSTER_SPRITE_LEVEL = 10
export const BOARD_WIDTH = 4
export const BOARD_HEIGHT = 4
export const SPAWN_QUEUE_LENGTH = 10
export const SPAWN_TIER = 1
export const FRIEND_SPAWN_CHANCE = 0.3
export const DEFAULT_RNG_SEED = 2048

export const ENEMY_TIER_PROGRESSION = [
  { tier: 2, chancePerTurn: 0.002, maxChance: 0.3 },
  { tier: 3, chancePerTurn: 0.0015, maxChance: 0.1 },
  { tier: 4, chancePerTurn: 0.0005, maxChance: 0.05 },
  { tier: 5, chancePerTurn: 0.00005, maxChance: 0.01 }
] as const

export const ENEMY_DEFEAT_REWARD = {
  score: 5,
  gold: 1,
  xp: 2
} as const

export const ENEMY_DEFEAT_SCORE_MULTIPLIER = 3
export const FRIENDLY_MERGE_SCORE = 3
export const FRIENDLY_MERGE_SCORE_MULTIPLIER = 2
export const ENEMY_TIER_UNLOCK_PLAYER_TIER = 3
export const SPELL_SLOT_COUNT = 4
export const SPELL_REFILL_INTERVAL = 10

export const MONSTER_TYPES: Record<string, MonsterTypeDefinition> = {
  dragon: {
    name: 'Dragon',
    faction: 'player',
    spritePrefix: 'dragon',
    baseMaxHp: 10,
    baseAtk: 2,
    hpMultiplier: 2,
    atkMultiplier: 2
  },
  griffin: {
    name: 'Griffin',
    faction: 'player',
    spritePrefix: 'griffin',
    baseMaxHp: 6,
    baseAtk: 3,
    hpMultiplier: 2,
    atkMultiplier: 2
  },
  skeletDragon: {
    name: 'Skelet Dragon',
    faction: 'enemy',
    spritePrefix: 'skeleton-dragon',
    baseMaxHp: 6,
    baseAtk: 2,
    hpMultiplier: 2,
    atkMultiplier: 2
  }
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxMonsterSpriteLevel: MAX_MONSTER_SPRITE_LEVEL,
  boardWidth: BOARD_WIDTH,
  boardHeight: BOARD_HEIGHT,
  spawnQueueLength: SPAWN_QUEUE_LENGTH,
  spawnTier: SPAWN_TIER,
  startingPlayerMonsterCount: 1,
  startingEnemyMonsterCount: 1,
  friendSpawnChance: FRIEND_SPAWN_CHANCE,
  rngSeed: null,
  enemyTierProgression: ENEMY_TIER_PROGRESSION.map(entry => ({ ...entry })),
  enemyDefeatReward: { ...ENEMY_DEFEAT_REWARD },
  enemyDefeatScoreMultiplier: ENEMY_DEFEAT_SCORE_MULTIPLIER,
  friendlyMergeScore: FRIENDLY_MERGE_SCORE,
  friendlyMergeScoreMultiplier: FRIENDLY_MERGE_SCORE_MULTIPLIER,
  enemyTierUnlockPlayerTier: ENEMY_TIER_UNLOCK_PLAYER_TIER,
  spellSlotCount: SPELL_SLOT_COUNT,
  spellRefillInterval: SPELL_REFILL_INTERVAL,
  monsterTypes: MONSTER_TYPES,
  playerMonsterTypes: ['dragon', 'griffin']
}

export function getMonsterDefinition(typeId: string, config: GameConfig = DEFAULT_GAME_CONFIG): MonsterTypeDefinition {
  const definition = config.monsterTypes[typeId]
  if (!definition) {
    throw new Error(`Unknown monster type: ${typeId}`)
  }

  return definition
}

export function getMonsterTypeIds(faction: Faction, config: GameConfig = DEFAULT_GAME_CONFIG): string[] {
  if (faction === 'player') {
    return config.playerMonsterTypes.filter(typeId => config.monsterTypes[typeId]?.faction === faction)
  }

  return Object.keys(config.monsterTypes).filter(typeId => config.monsterTypes[typeId]?.faction === faction)
}

export function getEnemyDefeatScore(tier: number, config: GameConfig = DEFAULT_GAME_CONFIG): number {
  return config.enemyDefeatReward.score * config.enemyDefeatScoreMultiplier ** (tier - 1)
}

/** Score for merging two friendly monsters of the given tier into the next one. */
export function getFriendlyMergeScore(tier: number, config: GameConfig = DEFAULT_GAME_CONFIG): number {
  return config.friendlyMergeScore * config.friendlyMergeScoreMultiplier ** (tier - 1)
}

function getMonsterSpriteFile(typeId: string, tier: number, config?: GameConfig): string {
  if (!Number.isInteger(tier) || tier < 1) {
    throw new Error(`Invalid monster tier: ${tier}`)
  }

  const definition = getMonsterDefinition(typeId, config)
  const spriteLevel = Math.min(tier, (config ?? DEFAULT_GAME_CONFIG).maxMonsterSpriteLevel)

  return `${definition.spritePrefix}-level-${spriteLevel}.png`
}

export function getMonsterSprite(typeId: string, tier: number, config?: GameConfig): string {
  return `/sprites/${getMonsterSpriteFile(typeId, tier, config)}`
}

/** Returns the square head portrait matching the full sprite of a monster. */
export function getMonsterHeadSprite(typeId: string, tier: number, config?: GameConfig): string {
  return `/sprites/heads/${getMonsterSpriteFile(typeId, tier, config)}`
}

export function getMonsterStats(typeId: string, tier: number, config?: GameConfig): { maxHp: number, atk: number } {
  if (!Number.isInteger(tier) || tier < 1) {
    throw new Error(`Invalid monster tier: ${tier}`)
  }

  const definition = getMonsterDefinition(typeId, config)
  const tierOffset = tier - 1

  return {
    maxHp: Math.round(definition.baseMaxHp * definition.hpMultiplier ** tierOffset),
    atk: Math.round(definition.baseAtk * definition.atkMultiplier ** tierOffset)
  }
}
