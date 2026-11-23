import { gameConfigSchema } from '../../game/configValidation'
import { defaultSpawnConfig } from '../../game/spawn'
import type { SpawnConfig } from '../../game/spawn'

type SpawnEditorState
  = | { status: 'invalid', message: string }
    | { status: 'legacy', rules: Record<string, unknown> }
    | { status: 'curve', rules: Record<string, unknown>, config: SpawnConfig }

export function readSpawnEditor(rulesJson: string): SpawnEditorState {
  let value: unknown
  try {
    value = JSON.parse(rulesJson)
  } catch {
    return { status: 'invalid', message: 'Enter valid rules JSON to edit the spawn curve.' }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { status: 'invalid', message: 'Rules JSON must be an object to edit the spawn curve.' }
  }
  const rules = value as Record<string, unknown>
  const friendly = gameConfigSchema.shape.friendSpawnChance.safeParse(rules.friendSpawnChance)
  const curve = gameConfigSchema.shape.enemySpawnCurve.safeParse(rules.enemySpawnCurve)
  if (!friendly.success || !curve.success) {
    return { status: 'invalid', message: 'Fix friendSpawnChance and enemySpawnCurve in the rules JSON to edit the spawn curve.' }
  }
  if (!curve.data) return { status: 'legacy', rules }
  return { status: 'curve', rules, config: { ...curve.data, friendlySpawnRate: friendly.data } }
}

export function updateSpawnEditor(state: Extract<SpawnEditorState, { status: 'curve' }>, config: SpawnConfig): string {
  const { friendlySpawnRate, ...curve } = config
  gameConfigSchema.shape.friendSpawnChance.parse(friendlySpawnRate)
  gameConfigSchema.shape.enemySpawnCurve.unwrap().parse(curve)
  const previousCurve = state.rules.enemySpawnCurve
  if (typeof previousCurve !== 'object' || previousCurve === null || Array.isArray(previousCurve)) {
    throw new Error('Cannot update an invalid spawn curve')
  }
  return JSON.stringify({
    ...state.rules,
    friendSpawnChance: friendlySpawnRate,
    enemySpawnCurve: { ...previousCurve, ...curve }
  }, null, 2)
}

export function enableSpawnCurve(state: Extract<SpawnEditorState, { status: 'legacy' }>): string {
  const { enemyTierProgression: _progression, enemyTierUnlockPlayerTier: _unlock, ...rules } = state.rules
  const { friendlySpawnRate: _friendly, ...curve } = defaultSpawnConfig
  return JSON.stringify({ ...rules, enemySpawnCurve: curve }, null, 2)
}
