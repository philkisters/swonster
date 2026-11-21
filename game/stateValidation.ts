import { z } from 'zod'
import { gameConfigSchema, spellIdSchema } from './configValidation'

const spawnEntrySchema = z.object({
  kind: z.enum(['friend', 'enemy', 'boss']),
  typeId: z.string(),
  tier: z.number().int().positive(),
})

const monsterSchema = z.object({
  id: z.string(),
  faction: z.enum(['player', 'enemy']),
  typeId: z.string(),
  tier: z.number().int().positive(),
  hp: z.number(),
  maxHp: z.number(),
  atk: z.number(),
  movable: z.boolean(),
  isBoss: z.boolean().optional(),
})

export const gameStateSchema = z.object({
  config: gameConfigSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  cells: z.array(monsterSchema.nullable()),
  turn: z.number().int().nonnegative(),
  score: z.number(),
  gold: z.number(),
  xp: z.number(),
  enemyTierUnlockTurn: z.number().int().nonnegative().nullable(),
  spawnQueue: z.array(spawnEntrySchema),
  rngSeed: z.number().int(),
  spellSlots: z.array(spellIdSchema.nullable()),
  spellRngSeed: z.number().int(),
  gameOver: z.boolean(),
  gameOverReason: z.enum(['board-full', 'no-friendly-monsters']).optional(),
}).refine(state =>
  state.cells.length === state.width * state.height
  && state.width === state.config.boardWidth
  && state.height === state.config.boardHeight,
'The saved board does not match its configuration.')

export const spawnHistorySchema = z.array(spawnEntrySchema).max(7)
