import type { DeepReadonly, Ref } from 'vue'
import { getSpellCost, SPELLS } from '~~/game/spells'
import type { SpellDefinition } from '~~/game/spells'
import { getTargetOptions, hasTargets, isSameTarget } from '~~/game/targeting'
import type { Target } from '~~/game/targeting'
import type { GameState, SpellId } from '~~/game/types'

export interface SpellCard {
  spellId: SpellId
  spell: SpellDefinition
  cost: number
  status: 'ready' | 'too-expensive' | 'no-target'
}

export interface SpellTargeting {
  slot: number
  prompt: string
  step: number
  stepCount: number
  options: Target[]
  chosen: Target[]
}

/**
 * Drives buying a spell: the player selects a card, picks one target per step,
 * and the spell is cast as soon as the last target is chosen.
 */
export function useSpellCasting(
  state: Readonly<Ref<DeepReadonly<GameState>>>,
  locked: Readonly<Ref<boolean>>,
  cast: (slot: number, targets: Target[]) => void
) {
  const activeSlot = ref<number | null>(null)
  const chosen = ref<Target[]>([])
  let queuedSlot: number | null = null

  const cards = computed(() => state.value.spellSlots.map((spellId): SpellCard | null => {
    if (!spellId) return null

    const spell = SPELLS[spellId]
    const cost = getSpellCost(spellId, state.value.config?.spellCostModifier)
    const status = state.value.gold < cost
      ? 'too-expensive'
      : hasTargets(state.value, spell.targets) ? 'ready' : 'no-target'

    return { spellId, spell, cost, status }
  }))

  const targeting = computed((): SpellTargeting | null => {
    const slot = activeSlot.value
    const spell = slot === null ? undefined : cards.value[slot]?.spell
    const step = spell?.targets[chosen.value.length]
    if (slot === null || !spell || !step) return null

    return {
      slot,
      prompt: step.prompt,
      step: chosen.value.length + 1,
      stepCount: spell.targets.length,
      options: getTargetOptions(state.value, spell.targets, chosen.value),
      chosen: chosen.value
    }
  })

  watch(locked, (isLocked) => {
    if (isLocked || queuedSlot === null) return

    const slot = queuedSlot
    queuedSlot = null
    select(slot)
  })

  function select(slot: number) {
    if (activeSlot.value === slot) {
      cancel()
    } else if (locked.value) {
      queuedSlot = slot
    } else if (cards.value[slot]?.status === 'ready') {
      activeSlot.value = slot
      chosen.value = []
    }
  }

  function pick(target: Target) {
    const current = targeting.value
    if (!current) return

    const pickedAt = current.chosen.findIndex(other => isSameTarget(other, target))
    if (pickedAt !== -1) {
      chosen.value = current.chosen.slice(0, pickedAt)
      return
    }
    if (!current.options.some(option => isSameTarget(option, target))) return

    const targets = [...current.chosen, target]
    if (current.step < current.stepCount) {
      chosen.value = targets
      return
    }

    cancel()
    cast(current.slot, targets)
  }

  function cancel() {
    activeSlot.value = null
    chosen.value = []
    queuedSlot = null
  }

  return { cards, targeting, select, pick, cancel }
}
