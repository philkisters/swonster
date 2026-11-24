import { describe, expect, it } from 'vitest'
import { addGold, changeTier, offerSpell } from '../game/cheats'
import { DEFAULT_GAME_CONFIG, getMonsterStats } from '../game/config'
import { createRock } from '../game/obstacles'
import { createSpawnQueue } from '../game/spawning'
import { createSpellSlots } from '../game/spellSlots'
import { castSpell } from '../game/spells'
import type { GameState, Monster, SpellId } from '../game/types'

function createState(spellSlots: (SpellId | null)[], pieces: [number, Monster][] = []): GameState {
  const cells: GameState['cells'] = Array(4).fill(null)
  for (const [index, piece] of pieces) {
    cells[index] = piece
  }

  return {
    width: 2,
    height: 2,
    cells,
    turn: 0,
    score: 0,
    gold: 5,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...createSpawnQueue(42),
    ...createSpellSlots(42),
    spellSlots
  }
}

const dragon = (overrides: Partial<Monster> = {}): Monster =>
  ({ id: 'dragon', faction: 'player', typeId: 'dragon', tier: 2, hp: 3, maxHp: 20, atk: 4, movable: true, ...overrides })

describe('cheats', () => {
  it('adds gold and never drops below zero', () => {
    const state = createState([null])

    expect(addGold(state, 100).gold).toBe(105)
    expect(addGold(state, -50).gold).toBe(0)
    expect(state.gold).toBe(5)
  })

  it('offers a spell in the first empty slot, or the last slot when all are taken', () => {
    expect(offerSpell(createState(['heal', null, null]), 'rock').spellSlots).toEqual(['heal', 'rock', null])
    expect(offerSpell(createState(['heal', 'move']), 'rock').spellSlots).toEqual(['heal', 'rock'])
  })

  it('makes a spell the rules leave out buyable', () => {
    const state = { ...createState([null]), config: { ...DEFAULT_GAME_CONFIG, availableSpells: ['heal'] satisfies SpellId[] } }

    const offered = offerSpell(state, 'rock')

    expect(castSpell({ ...state, spellSlots: ['rock'] }, 0, [{ shape: 'cell', index: 0 }]).valid).toBe(false)
    expect(castSpell(offered, 0, [{ shape: 'cell', index: 0 }]).valid).toBe(true)
    expect(state.config.availableSpells).toEqual(['heal'])
  })

  it('changes the level of a monster and restores it to the full health of that level', () => {
    const state = createState([null], [[0, dragon()], [1, dragon({ id: 'enemy', faction: 'enemy', typeId: 'skeletDragon' })]])

    const raised = changeTier(state, 0, 1).cells[0]
    const lowered = changeTier(state, 1, -1).cells[1]

    expect(raised).toMatchObject({ id: 'dragon', tier: 3, ...getMonsterStats('dragon', 3), hp: getMonsterStats('dragon', 3).maxHp })
    expect(lowered).toMatchObject({ id: 'enemy', tier: 1, ...getMonsterStats('skeletDragon', 1) })
    expect(state.cells[0]?.tier).toBe(2)
  })

  it('leaves level 1 monsters, rocks and empty cells alone', () => {
    const state = createState([null], [[0, dragon({ tier: 1 })], [1, createRock('rock')]])

    expect(changeTier(state, 0, -1)).toBe(state)
    expect(changeTier(state, 1, 1)).toBe(state)
    expect(changeTier(state, 2, 1)).toBe(state)
  })
})
