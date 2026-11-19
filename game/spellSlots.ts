import { DEFAULT_RNG_SEED, SPELL_SLOT_COUNT } from './config'
import { nextSeed } from './rng'
import { SPELLS } from './spells'
import type { GameState, SpellId } from './types'

type SpellSlotState = Pick<GameState, 'spellSlots' | 'spellRngSeed'>

const SPELL_SEED_OFFSET = 0x9e3779b9

export function createSpellSlots(seed = DEFAULT_RNG_SEED): SpellSlotState {
  return {
    spellSlots: Array(SPELL_SLOT_COUNT).fill(null),
    spellRngSeed: (seed ^ SPELL_SEED_OFFSET) >>> 0
  }
}

/**
 * Deals a random spell that is not on offer yet into the first empty slot.
 * With every slot taken nothing changes, so a spell has to be bought before new ones arrive.
 */
export function refillSpellSlot({ spellSlots, spellRngSeed }: SpellSlotState): SpellSlotState {
  const slot = spellSlots.indexOf(null)
  const available = (Object.keys(SPELLS) as SpellId[]).filter(spellId => !spellSlots.includes(spellId))
  if (slot === -1 || available.length === 0) return { spellSlots, spellRngSeed }

  const rngSeed = nextSeed(spellRngSeed)
  const spellId = available[Math.floor(rngSeed / 0x100000000 * available.length)] ?? null

  return { spellSlots: spellSlots.with(slot, spellId), spellRngSeed: rngSeed }
}
