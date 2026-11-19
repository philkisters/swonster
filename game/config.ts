import type { Faction } from './types'

export interface MonsterTypeDefinition {
  name: string
  faction: Faction
  spritePrefix: string
  baseMaxHp: number
  baseAtk: number
  hpMultiplier: number
  atkMultiplier: number
}

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

export function getMonsterDefinition(typeId: string): MonsterTypeDefinition {
  const definition = MONSTER_TYPES[typeId]
  if (!definition) {
    throw new Error(`Unknown monster type: ${typeId}`)
  }

  return definition
}

export function getMonsterTypeIds(faction: Faction): string[] {
  return Object.keys(MONSTER_TYPES).filter(typeId => MONSTER_TYPES[typeId]?.faction === faction)
}

export function getEnemyDefeatScore(tier: number): number {
  return ENEMY_DEFEAT_REWARD.score * ENEMY_DEFEAT_SCORE_MULTIPLIER ** (tier - 1)
}

/** Score for merging two friendly monsters of the given tier into the next one. */
export function getFriendlyMergeScore(tier: number): number {
  return FRIENDLY_MERGE_SCORE * FRIENDLY_MERGE_SCORE_MULTIPLIER ** (tier - 1)
}

function getMonsterSpriteFile(typeId: string, tier: number): string {
  if (!Number.isInteger(tier) || tier < 1) {
    throw new Error(`Invalid monster tier: ${tier}`)
  }

  const definition = getMonsterDefinition(typeId)
  const spriteLevel = Math.min(tier, MAX_MONSTER_SPRITE_LEVEL)

  return `${definition.spritePrefix}-level-${spriteLevel}.png`
}

export function getMonsterSprite(typeId: string, tier: number): string {
  return `/sprites/${getMonsterSpriteFile(typeId, tier)}`
}

/** Returns the square head portrait matching the full sprite of a monster. */
export function getMonsterHeadSprite(typeId: string, tier: number): string {
  return `/sprites/heads/${getMonsterSpriteFile(typeId, tier)}`
}

export function getMonsterStats(typeId: string, tier: number): { maxHp: number, atk: number } {
  if (!Number.isInteger(tier) || tier < 1) {
    throw new Error(`Invalid monster tier: ${tier}`)
  }

  const definition = getMonsterDefinition(typeId)
  const tierOffset = tier - 1

  return {
    maxHp: Math.round(definition.baseMaxHp * definition.hpMultiplier ** tierOffset),
    atk: Math.round(definition.baseAtk * definition.atkMultiplier ** tierOffset)
  }
}
