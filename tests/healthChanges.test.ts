import { describe, expect, it } from 'vitest'
import { getHealthChanges } from '../game/healthChanges'
import type { Monster } from '../game/types'

function createMonster(id: string, overrides: Partial<Monster> = {}): Monster {
  return { id, faction: 'player', typeId: 'dragon', tier: 1, hp: 8, maxHp: 8, atk: 2, movable: true, ...overrides }
}

describe('getHealthChanges', () => {
  it('reports damage as a negative and healing as a positive amount', () => {
    const before = [createMonster('hurt'), null, createMonster('healed', { hp: 3 }), createMonster('same')]
    const after = [createMonster('hurt', { hp: 5 }), null, createMonster('healed'), createMonster('same')]

    expect(getHealthChanges(before, after)).toEqual([
      { cell: 0, amount: -3 },
      { cell: 2, amount: 5 }
    ])
  })

  it('counts a monster that left the board as having lost its remaining HP', () => {
    expect(getHealthChanges([null, createMonster('defeated', { hp: 2 })], [null, null])).toEqual([
      { cell: 1, amount: -2 }
    ])
  })

  it('follows a monster to the cell it stands on afterwards', () => {
    expect(getHealthChanges([createMonster('moved'), null], [null, createMonster('moved', { hp: 6 })])).toEqual([
      { cell: 1, amount: -2 }
    ])
  })

  it('ignores monsters that were transformed or only just appeared', () => {
    const before = [createMonster('evolved', { hp: 1 }), null]
    const after = [createMonster('evolved', { tier: 2, hp: 16, maxHp: 16 }), createMonster('spawned')]

    expect(getHealthChanges(before, after)).toEqual([])
  })
})
