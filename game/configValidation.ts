import { z } from 'zod'

export const SPELL_IDS = [
  'fireball', 'fireballBarrage', 'move', 'swap', 'superMove', 'superSwap',
  'typeChange', 'fusion', 'convertEnemy', 'heal', 'evolve'
] as const
export const spellIdSchema = z.enum(SPELL_IDS)

const monsterTypeSchema = z.looseObject({
  name: z.string().refine(value => value.trim().length > 0, 'Name must not be blank'),
  faction: z.enum(['player', 'enemy']),
  spritePrefix: z.string().regex(/^[a-z0-9-]+$/),
  baseMaxHp: z.number().min(1).max(100000),
  baseAtk: z.number().min(1).max(100000),
  hpMultiplier: z.number().min(1).max(10),
  atkMultiplier: z.number().min(1).max(10)
})

const monsterTypesSchema = z.record(z.string(), monsterTypeSchema).superRefine((types, ctx) => {
  if (Object.keys(types).length > 100) {
    ctx.addIssue({ code: 'custom', message: 'At most 100 monster types are allowed' })
  }
  for (const [typeId, faction] of [['dragon', 'player'], ['griffin', 'player'], ['skeletDragon', 'enemy']] as const) {
    if (types[typeId]?.faction !== faction) {
      ctx.addIssue({ code: 'custom', path: [typeId], message: `Required ${faction} monster type` })
    }
  }
})

export const gameConfigSchema = z.looseObject({
  maxMonsterSpriteLevel: z.number().int().min(1).max(10),
  boardWidth: z.number().int().min(3).max(8),
  boardHeight: z.number().int().min(3).max(8),
  spawnQueueLength: z.number().int().min(1).max(100),
  spawnTier: z.number().int().min(1).max(10),
  startingPlayerMonsterCount: z.number().int().min(1).max(64).default(1),
  startingEnemyMonsterCount: z.number().int().min(0).max(64).default(1),
  friendSpawnChance: z.number().min(0).max(1),
  rngSeed: z.number().int().min(0).max(0xffffffff).nullable(),
  enemySpawnCurve: z.object({
    difficultyBuffer: z.number().min(0).max(1),
    maxActiveTiers: z.number().int().min(2).max(12),
    peakPosition: z.number().gt(0).lt(1),
    maxTier: z.number().int().min(1).max(12)
  }).optional(),
  enemyTierProgression: z.array(z.looseObject({
    tier: z.number().int().min(1).max(10),
    chancePerTurn: z.number().min(0).max(1),
    maxChance: z.number().min(0).max(1)
  })).readonly().refine(
    entries => entries.reduce((sum, entry) => sum + entry.maxChance, 0) <= 1,
    'Total maximum enemy tier chance must not exceed 1'
  ).nullish(),
  enemyDefeatReward: z.looseObject({
    score: z.number().min(0).max(100000),
    gold: z.number().min(0).max(100000),
    xp: z.number().min(0).max(100000)
  }),
  enemyDefeatScoreMultiplier: z.number().min(1).max(10),
  friendlyMergeScore: z.number().min(0).max(100000),
  friendlyMergeScoreMultiplier: z.number().min(1).max(10),
  enemyTierUnlockPlayerTier: z.number().int().min(1).max(100).nullish(),
  spellSlotCount: z.number().int().min(1).max(11),
  spellRefillInterval: z.number().int().min(1).max(10000),
  availableSpells: z.array(spellIdSchema).readonly().default(() => [...SPELL_IDS]),
  spellCostModifier: z.number().min(0).max(100000).default(1),
  monsterTypes: monsterTypesSchema,
  playerMonsterTypes: z.array(z.string().min(1)).min(1).readonly().default(['dragon', 'griffin'])
}).superRefine((config, ctx) => {
  if (!config.enemySpawnCurve) {
    if (!config.enemyTierProgression) {
      ctx.addIssue({ code: 'custom', path: ['enemyTierProgression'], message: 'Required without an enemy spawn curve' })
    }
    if (config.enemyTierUnlockPlayerTier === undefined || config.enemyTierUnlockPlayerTier === null) {
      ctx.addIssue({ code: 'custom', path: ['enemyTierUnlockPlayerTier'], message: 'Required without an enemy spawn curve' })
    }
  }

  if (config.startingPlayerMonsterCount + config.startingEnemyMonsterCount > config.boardWidth * config.boardHeight) {
    ctx.addIssue({
      code: 'custom',
      path: ['startingEnemyMonsterCount'],
      message: 'Starting monsters must fit on the board'
    })
  }

  if (new Set(config.availableSpells).size !== config.availableSpells.length) {
    ctx.addIssue({ code: 'custom', path: ['availableSpells'], message: 'Available spells must be unique' })
  }

  const seen = new Set<string>()
  for (const [index, typeId] of config.playerMonsterTypes.entries()) {
    if (seen.has(typeId)) {
      ctx.addIssue({ code: 'custom', path: ['playerMonsterTypes', index], message: 'Player monster types must be unique' })
    }
    if (config.monsterTypes[typeId]?.faction !== 'player') {
      ctx.addIssue({ code: 'custom', path: ['playerMonsterTypes', index], message: 'Must reference a configured player monster type' })
    }
    seen.add(typeId)
  }
})

const availableConfigSchema = z.looseObject({
  name: z.string().refine(value => value.trim().length > 0, 'Name must not be blank'),
  rules: gameConfigSchema,
  archived: z.boolean().optional()
})

export type MonsterTypeDefinition = z.infer<typeof monsterTypeSchema>
export type GameConfig = z.infer<typeof gameConfigSchema>

export interface AvailableConfig {
  id: string
  name: string
  rules: GameConfig
  archived?: boolean
}

export function isGameConfig(value: unknown): value is GameConfig {
  return typeof value === 'object'
    && value !== null
    && 'playerMonsterTypes' in value
    && 'availableSpells' in value
    && 'spellCostModifier' in value
    && gameConfigSchema.safeParse(value).success
}

export function parseAvailableConfig(id: string, value: unknown): AvailableConfig {
  if (!id || id === '__legacy__') throw new Error(`Invalid game configuration: ${id}`)
  const result = availableConfigSchema.safeParse(value)
  if (!result.success) {
    const details = result.error.issues.map(issue => `${issue.path.join('.') || 'document'}: ${issue.message}`).join('; ')
    throw new Error(`Invalid game configuration: ${id} (${details})`)
  }
  return {
    id,
    name: result.data.name,
    rules: result.data.rules,
    ...(result.data.archived === undefined ? {} : { archived: result.data.archived })
  }
}
