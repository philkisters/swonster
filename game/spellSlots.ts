import { DEFAULT_GAME_CONFIG, DEFAULT_RNG_SEED } from './config'
import type { GameConfig } from './config'
import { nextSeed } from './rng'
import { SPELLS } from './spells'
import type { GameState, SpellId } from './types'

type SpellSlotState = Pick<GameState, 'spellSlots' | 'spellRngSeed'>

const SPELL_SEED_OFFSET = 0x9e3779b9

export function createSpellSlots(seed = DEFAULT_RNG_SEED, config: GameConfig = DEFAULT_GAME_CONFIG): SpellSlotState {
  return {
    spellSlots: Array(config.spellSlotCount).fill(null),
    spellRngSeed: (seed ^ SPELL_SEED_OFFSET) >>> 0
  }
}

/**
 * Deals a random spell that is not on offer yet into the first empty slot.
 * With every slot taken nothing changes, so a spell has to be bought before new ones arrive. The engine calls this every SPELL_REFILL_INTERVAL turns.
 */
export function refillSpellSlot({ spellSlots, spellRngSeed }: SpellSlotState): SpellSlotState {
  const slot = spellSlots.indexOf(null)
  const available = (Object.keys(SPELLS) as SpellId[]).filter(spellId => !spellSlots.includes(spellId))
  if (slot === -1 || available.length === 0) return { spellSlots, spellRngSeed }

  const rngSeed = nextSeed(spellRngSeed)
  const spellId = available[Math.floor(rngSeed / 0x100000000 * available.length)] ?? null

  return { spellSlots: spellSlots.with(slot, spellId), spellRngSeed: rngSeed }
}
