import { describe, expect, it } from 'vitest'
import { enableSpawnCurve, readSpawnEditor, updateSpawnEditor } from '../app/utils/spawnConfigEditor'
import { DEFAULT_GAME_CONFIG, ENEMY_TIER_PROGRESSION, ENEMY_TIER_UNLOCK_PLAYER_TIER } from '../game/config'
import { isGameConfig } from '../game/configValidation'

describe('spawn configuration editor', () => {
  it('reads the current rules and updates only spawn settings', () => {
    const rules = {
      ...DEFAULT_GAME_CONFIG,
      friendSpawnChance: 0.6,
      enemySpawnCurve: { ...DEFAULT_GAME_CONFIG.enemySpawnCurve, maxTier: 8, extra: 'preserved' },
      boardWidth: 5,
      customField: 'preserved'
    }
    const state = readSpawnEditor(JSON.stringify(rules))
    expect(state.status).toBe('curve')
    if (state.status !== 'curve') throw new Error('Expected curve settings')
    expect(state.config).toMatchObject({ friendlySpawnRate: 0.6, maxTier: 8 })

    const edited = updateSpawnEditor(state, { ...state.config, friendlySpawnRate: 0.25, maxTier: 12, peakPosition: 0.7 })
    const saved: unknown = JSON.parse(edited)
    expect(saved).toMatchObject({
      friendSpawnChance: 0.25,
      enemySpawnCurve: { maxTier: 12, peakPosition: 0.7, extra: 'preserved' },
      boardWidth: 5,
      customField: 'preserved'
    })
    expect(isGameConfig(saved)).toBe(true)
    expect(readSpawnEditor(edited)).toMatchObject({ status: 'curve', config: { friendlySpawnRate: 0.25, maxTier: 12 } })
  })

  it('converts legacy rules only on explicit request and preserves unrelated settings', () => {
    const { enemySpawnCurve: _curve, ...rules } = DEFAULT_GAME_CONFIG
    const legacy = {
      ...rules,
      friendSpawnChance: 0,
      enemyTierProgression: ENEMY_TIER_PROGRESSION,
      enemyTierUnlockPlayerTier: ENEMY_TIER_UNLOCK_PLAYER_TIER,
      customField: 'preserved'
    }
    const state = readSpawnEditor(JSON.stringify(legacy))
    expect(state.status).toBe('legacy')
    if (state.status !== 'legacy') throw new Error('Expected legacy settings')
    const converted: unknown = JSON.parse(enableSpawnCurve(state))
    expect(converted).toMatchObject({ friendSpawnChance: 0, enemySpawnCurve: DEFAULT_GAME_CONFIG.enemySpawnCurve, customField: 'preserved' })
    expect(converted).not.toHaveProperty('enemyTierProgression')
    expect(converted).not.toHaveProperty('enemyTierUnlockPlayerTier')
    expect(isGameConfig(converted)).toBe(true)
  })

  it.each([
    '{',
    '[]',
    JSON.stringify({ ...DEFAULT_GAME_CONFIG, friendSpawnChance: 2 }),
    JSON.stringify({ ...DEFAULT_GAME_CONFIG, enemySpawnCurve: { ...DEFAULT_GAME_CONFIG.enemySpawnCurve, peakPosition: 0 } })
  ])('reports invalid JSON or spawn settings without replacing them', (json) => {
    expect(readSpawnEditor(json)).toMatchObject({ status: 'invalid', message: expect.any(String) })
  })
})
