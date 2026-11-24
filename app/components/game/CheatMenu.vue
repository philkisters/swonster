<template>
  <details
    class="game-cheats"
    open
  >
    <summary class="game-cheats-summary">
      <UIcon
        name="lucide:wrench"
        aria-hidden="true"
      />
      Cheats
      <span class="game-cheats-badge">dev only</span>
    </summary>

    <div class="game-cheats-row">
      <span class="game-cheats-label">Gold</span>
      <button
        v-for="amount in GOLD_AMOUNTS"
        :key="amount"
        type="button"
        class="game-cheats-button"
        :disabled="disabled"
        @click="emit('gold', amount)"
      >
        +{{ amount }}
      </button>
    </div>

    <div class="game-cheats-row">
      <span class="game-cheats-label">Levels</span>
      <button
        v-for="tool in LEVEL_TOOLS"
        :key="tool.id"
        type="button"
        class="game-cheats-button"
        :class="{ 'game-cheats-button--active': levelTool === tool.id }"
        :disabled="disabled"
        :aria-pressed="levelTool === tool.id"
        @click="emit('levelTool', tool.id)"
      >
        <UIcon
          :name="tool.icon"
          aria-hidden="true"
        />
        {{ tool.label }}
      </button>
      <span
        v-if="levelTool"
        class="game-cheats-hint"
      >Tap monsters on the board. Tap the button again to stop.</span>
    </div>

    <div class="game-cheats-row">
      <span class="game-cheats-label">Spells</span>
      <ul class="game-cheats-spells">
        <li
          v-for="spell in spells"
          :key="spell.id"
        >
          <button
            type="button"
            class="game-cheats-spell"
            :disabled="disabled"
            :title="`${spell.name}: ${spell.description}`"
            :aria-label="`Offer ${spell.name}, ${spell.cost} gold`"
            @click="emit('spell', spell.id)"
          >
            <img
              class="game-cheats-spell-sprite"
              :src="spriteUrl(getSpellSprite(spell.id))"
              alt=""
              draggable="false"
            >
            <span class="game-cheats-spell-name">{{ spell.name }}</span>
            <span class="game-cheats-spell-cost">{{ spell.cost }}</span>
          </button>
        </li>
      </ul>
    </div>

    <p class="game-cheats-note">
      A spell goes into the first empty slot, or replaces the last one, and is bought like any other.
      While cheats are on, games are not saved to Firebase.
    </p>
  </details>
</template>

<script setup lang="ts">
import { SPELL_IDS } from '~~/game/configValidation'
import { getSpellCost, getSpellSprite, SPELLS } from '~~/game/spells'
import type { SpellId } from '~~/game/types'
import type { LevelTool } from '~/composables/useCheats'

const GOLD_AMOUNTS = [10, 100, 1000]
const LEVEL_TOOLS: { id: LevelTool, label: string, icon: string }[] = [
  { id: 'up', label: 'Level up', icon: 'lucide:arrow-up' },
  { id: 'down', label: 'Level down', icon: 'lucide:arrow-down' }
]

const props = defineProps<{
  levelTool: LevelTool | null
  costModifier?: number
  disabled?: boolean
}>()
const emit = defineEmits<{
  gold: [amount: number]
  spell: [spellId: SpellId]
  levelTool: [tool: LevelTool]
}>()

const spriteUrl = useSpriteUrl()

const spells = computed(() => SPELL_IDS.map(id => ({
  id,
  name: SPELLS[id].name,
  description: SPELLS[id].description,
  cost: getSpellCost(id, props.costModifier)
})))
</script>

<style scoped>
.game-cheats {
  display: grid;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border: 1px dashed var(--ui-color-warning-500);
  border-radius: 0.9rem;
  background: var(--ui-bg-elevated);
  font-size: 0.8rem;
}

.game-cheats-summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 800;
  cursor: pointer;
}

.game-cheats[open] .game-cheats-summary {
  margin-bottom: 0.6rem;
}

.game-cheats-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--ui-color-warning-500);
  color: var(--ui-bg);
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.game-cheats-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}

.game-cheats-row:has(.game-cheats-spells) {
  align-items: flex-start;
}

.game-cheats-label {
  width: 3.2rem;
  flex: 0 0 auto;
  color: var(--ui-text-muted);
  font-weight: 750;
}

.game-cheats-button {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.65rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 0.6rem;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  font-variant-numeric: tabular-nums;
  font-weight: 750;
  cursor: pointer;
}

.game-cheats-button:not(:disabled):hover,
.game-cheats-spell:not(:disabled):hover {
  border-color: var(--game-target);
}

.game-cheats-button--active {
  border-color: var(--game-target);
  background: color-mix(in srgb, var(--game-target) 18%, var(--ui-bg));
}

.game-cheats-button:disabled,
.game-cheats-spell:disabled {
  cursor: default;
  opacity: 0.5;
}

.game-cheats-hint {
  flex: 1 1 100%;
  color: var(--game-target);
  font-weight: 700;
}

.game-cheats-spells {
  display: grid;
  min-width: 0;
  flex: 1 1 0;
  grid-template-columns: repeat(auto-fill, minmax(4.2rem, 1fr));
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.game-cheats-spell {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.35rem 0.2rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 0.6rem;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
  cursor: pointer;
}

.game-cheats-spell-sprite {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.game-cheats-spell-name {
  font-size: 0.62rem;
  font-weight: 750;
  line-height: 1.1;
  text-align: center;
}

.game-cheats-spell-cost {
  position: absolute;
  top: 0.15rem;
  right: 0.3rem;
  color: var(--game-gold-text);
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.game-cheats-note {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.72rem;
  line-height: 1.35;
}
</style>
