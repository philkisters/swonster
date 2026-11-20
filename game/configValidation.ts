import { z } from 'zod'

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
  boardWidth: z.number().int().min(4).max(8),
  boardHeight: z.number().int().min(4).max(8),
  spawnQueueLength: z.number().int().min(1).max(100),
  spawnTier: z.number().int().min(1).max(10),
  friendSpawnChance: z.number().min(0).max(1),
  rngSeed: z.number().int().min(0).max(0xffffffff).nullable(),
  enemyTierProgression: z.array(z.looseObject({
    tier: z.number().int().min(1).max(10),
    chancePerTurn: z.number().min(0).max(1),
    maxChance: z.number().min(0).max(1)
  })).readonly().refine(
    entries => entries.reduce((sum, entry) => sum + entry.maxChance, 0) <= 1,
    'Total maximum enemy tier chance must not exceed 1'
  ),
  enemyDefeatReward: z.looseObject({
    score: z.number().min(0).max(100000),
    gold: z.number().min(0).max(100000),
    xp: z.number().min(0).max(100000)
  }),
  enemyDefeatScoreMultiplier: z.number().min(1).max(10),
  friendlyMergeScore: z.number().min(0).max(100000),
  friendlyMergeScoreMultiplier: z.number().min(1).max(10),
  enemyTierUnlockPlayerTier: z.number().int().min(1).max(100),
  spellSlotCount: z.number().int().min(1).max(11),
  spellRefillInterval: z.number().int().min(1).max(10000),
  monsterTypes: monsterTypesSchema
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
  return gameConfigSchema.safeParse(value).success
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
