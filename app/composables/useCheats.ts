import type { DeepReadonly, Ref } from 'vue'
import { addGold, changeTier, offerSpell } from '~~/game/cheats'
import { isObstacle } from '~~/game/obstacles'
import type { Target } from '~~/game/targeting'
import type { GameState, SpellId } from '~~/game/types'

export type LevelTool = 'up' | 'down'

/** Whether the development cheats are on: only under `nuxt dev` with NUXT_PUBLIC_CHEATS=true. */
export function areCheatsEnabled(): boolean {
  return import.meta.dev && useRuntimeConfig().public.cheats === true
}

/**
 * Development cheats. Every cheat goes through `patch`, which replaces the game state outside the rules.
 * Games played with cheats on are never saved; see the `saveGames` option of `useGameTracking`.
 */
export function useCheats(
  state: Readonly<Ref<DeepReadonly<GameState>>>,
  patch: (change: (state: GameState) => GameState) => void
) {
  const enabled = areCheatsEnabled()
  const levelTool = ref<LevelTool | null>(null)

  const levelTargeting = computed(() => {
    const tool = levelTool.value
    if (!enabled || !tool) return null

    return {
      options: state.value.cells.flatMap((monster, index): Target[] =>
        monster && !isObstacle(monster) && (tool === 'up' || monster.tier > 1) ? [{ shape: 'cell', index }] : []
      ),
      chosen: []
    }
  })

  function giveGold(amount: number) {
    if (enabled) patch(current => addGold(current, amount))
  }

  function giveSpell(spellId: SpellId) {
    if (enabled) patch(current => offerSpell(current, spellId))
  }

  function toggleLevelTool(tool: LevelTool) {
    levelTool.value = levelTool.value === tool ? null : tool
  }

  function stopLevelTool() {
    levelTool.value = null
  }

  function changeLevel(target: Target) {
    const tool = levelTool.value
    if (!enabled || !tool || target.shape !== 'cell') return

    patch(current => changeTier(current, target.index, tool === 'up' ? 1 : -1))
  }

  return { enabled, levelTool, levelTargeting, giveGold, giveSpell, toggleLevelTool, stopLevelTool, changeLevel }
}
