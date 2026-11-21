import { describe, expect, it } from 'vitest'
import { gameModeSpritePath, selectGameMode } from '../app/utils/gameModes'

describe('game modes', () => {
  it('uses the same sprite for versioned IDs and leaves other IDs intact', () => {
    expect(gameModeSpritePath('default-dragon-v123')).toBe('/sprites/gamemodes/default-dragon.png')
    expect(gameModeSpritePath('default-2-types-v1')).toBe('/sprites/gamemodes/default-2-types.png')
    expect(gameModeSpritePath('default-griffin')).toBe('/sprites/gamemodes/default-griffin.png')
    expect(gameModeSpritePath('custom-v1-copy')).toBe('/sprites/gamemodes/custom-v1-copy.png')
  })

  it('defaults to the two-types mode while preserving a valid selection', () => {
    const configs = [{ id: 'default-dragon-v1' }, { id: 'default-2-types-v2' }]
    expect(selectGameMode(configs, '')).toBe('default-2-types-v2')
    expect(selectGameMode(configs, 'default-dragon-v1')).toBe('default-dragon-v1')
    expect(selectGameMode([{ id: 'custom' }], 'missing')).toBe('custom')
    expect(selectGameMode([], '')).toBe('')
  })
})
