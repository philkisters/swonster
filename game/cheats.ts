import { DEFAULT_GAME_CONFIG, getMonsterStats } from './config'
import { isObstacle } from './obstacles'
import type { GameState, SpellId } from './types'

/** Development cheat: adds gold, or takes it away with a negative amount. */
export function addGold(state: GameState, amount: number): GameState {
  return { ...state, gold: Math.max(0, state.gold + amount) }
}

/**
 * Development cheat: puts a spell on offer in the first empty slot, or in the last slot when all are taken.
 * A spell the run's rules leave out is added to them, so it can be bought like any other.
 */
export function offerSpell(state: GameState, spellId: SpellId): GameState {
  const emptySlot = state.spellSlots.indexOf(null)
  const slot = emptySlot === -1 ? state.spellSlots.length - 1 : emptySlot
  if (slot < 0) return state

  const config = state.config ?? DEFAULT_GAME_CONFIG

  return {
    ...state,
    spellSlots: state.spellSlots.with(slot, spellId),
    ...(config.availableSpells.includes(spellId)
      ? {}
      : { config: { ...config, availableSpells: [...config.availableSpells, spellId] } })
  }
}

/** Development cheat: raises or lowers the level of the monster on a cell and restores it to full health. */
export function changeTier(state: GameState, index: number, delta: number): GameState {
  const monster = state.cells[index]
  if (!monster || isObstacle(monster)) return state

  const tier = Math.max(1, monster.tier + delta)
  if (tier === monster.tier) return state

  const { maxHp, atk } = getMonsterStats(monster.typeId, tier, state.config)

  return { ...state, cells: state.cells.with(index, { ...monster, tier, maxHp, atk, hp: maxHp }) }
}
