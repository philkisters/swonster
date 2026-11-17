import { describe, expect, it } from 'vitest'
import { getMonsterSprite } from '../game/config'

describe('monster sprites', () => {
  it.each([
    ['dragon', '/sprites/dragon-level-1.png'],
    ['griffin', '/sprites/griffin-level-5.png'],
    ['skeletDragon', '/sprites/skeleton-dragon-level-10.png']
  ] as const)('uses the sprite for the monster type and level', (typeId, expected) => {
    const tier = Number(expected.match(/level-(\d+)/)![1])

    expect(getMonsterSprite(typeId, tier)).toBe(expected)
  })

  it('caps levels above ten at the final sprite', () => {
    expect(getMonsterSprite('dragon', 11)).toBe('/sprites/dragon-level-10.png')
    expect(getMonsterSprite('griffin', 100)).toBe('/sprites/griffin-level-10.png')
    expect(getMonsterSprite('skeletDragon', 20)).toBe('/sprites/skeleton-dragon-level-10.png')
  })

  it.each([0, -1, 1.5, Number.NaN])('rejects invalid level %s', (tier) => {
    expect(() => getMonsterSprite('dragon', tier)).toThrow('Invalid monster tier')
  })
})
