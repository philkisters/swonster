<template>
  <section
    class="spell-bar"
    aria-label="Spells"
  >
    <ul class="spell-slots">
      <li
        v-for="(card, slot) in cards"
        :key="slot"
        class="spell-slot"
      >
        <button
          v-if="card"
          :key="card.spellId"
          type="button"
          class="spell-card pixel-frame"
          :class="{
            'spell-card--active': targeting?.slot === slot,
            'spell-card--unavailable': card.status !== 'ready'
          }"
          :disabled="disabled"
          :aria-pressed="targeting?.slot === slot"
          :aria-label="`${card.spell.name}, ${card.spell.cost} gold`"
          @pointerdown="startPress(slot)"
          @pointerup="endPress"
          @pointerleave="endPress"
          @pointercancel="endPress"
          @pointerenter="onPointerEnter($event, slot)"
          @focus="inspectedSlot = slot"
          @contextmenu.prevent
          @click="onClick(slot, card)"
        >
          <img
            class="spell-card-sprite"
            :src="spriteUrl(getSpellSprite(card.spellId))"
            alt=""
            draggable="false"
          >
          <span class="spell-card-name">{{ card.spell.name }}</span>
          <span
            class="spell-cost spell-card-cost pixel-frame"
            :class="{ 'spell-cost--short': card.status === 'too-expensive' }"
          >
            <img
              class="spell-cost-icon"
              :src="spriteUrl('/sprites/ui/gold.png')"
              alt=""
            >
            {{ card.spell.cost }}
          </span>
        </button>
      </li>
    </ul>

    <div
      class="spell-detail pixel-frame"
      :class="{ 'spell-detail--targeting': targeting }"
      aria-live="polite"
    >
      <template v-if="shownCard">
        <div class="spell-detail-main">
          <img
            class="spell-detail-sprite"
            :src="spriteUrl(getSpellSprite(shownCard.spellId))"
            alt=""
            draggable="false"
          >
          <div class="spell-detail-text">
            <p class="spell-detail-title">
              {{ shownCard.spell.name }}
              <span
                class="spell-cost"
                :class="{ 'spell-cost--short': shownCard.status === 'too-expensive' }"
              >
                <img
                  class="spell-cost-icon"
                  :src="spriteUrl('/sprites/ui/gold.png')"
                  alt="Gold"
                >
                {{ shownCard.spell.cost }}
              </span>
            </p>
            <p class="spell-detail-description">
              {{ shownCard.spell.description }}
            </p>
          </div>
          <button
            v-if="targeting"
            type="button"
            class="spell-detail-cancel pixel-button"
            @click="emit('cancel')"
          >
            Cancel
          </button>
        </div>
        <p
          v-if="targeting"
          class="spell-detail-prompt"
        >
          <PixelIcon
            name="crosshair"
            class="spell-detail-prompt-icon"
          />
          <span>{{ targeting.prompt }}</span>
          <span
            v-if="targeting.stepCount > 1"
            class="spell-detail-step"
          >{{ targeting.step }}/{{ targeting.stepCount }}</span>
        </p>
        <p
          v-else
          class="spell-detail-note"
        >
          {{ STATUS_NOTES[shownCard.status] }}
        </p>
      </template>
      <p
        v-else
        class="spell-detail-hint"
      >
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getSpellSprite } from '~~/game/spells'
import type { SpellCard, SpellTargeting } from '~/composables/useSpellCasting'

const LONG_PRESS_MS = 400
const STATUS_NOTES: Record<SpellCard['status'], string> = {
  'ready': 'Tap the card to cast it.',
  'too-expensive': 'Not enough gold.',
  'no-target': 'No valid target on the board right now.'
}

const props = defineProps<{
  cards: readonly (SpellCard | null)[]
  targeting: SpellTargeting | null
  disabled?: boolean
}>()
const emit = defineEmits<{
  select: [slot: number]
  cancel: []
}>()

const spriteUrl = useSpriteUrl()
const inspectedSlot = ref<number | null>(null)
let pressTimer: ReturnType<typeof setTimeout> | undefined
let longPressed = false

const shownCard = computed(() => {
  const slot = props.targeting?.slot ?? inspectedSlot.value

  return slot === null ? null : props.cards[slot] ?? null
})

watch(() => props.targeting?.slot, (slot) => {
  if (slot === undefined) inspectedSlot.value = null
})

onBeforeUnmount(() => clearTimeout(pressTimer))

function startPress(slot: number) {
  longPressed = false
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    longPressed = true
    inspectedSlot.value = slot
  }, LONG_PRESS_MS)
}

function endPress() {
  clearTimeout(pressTimer)
}

function onPointerEnter(event: PointerEvent, slot: number) {
  if (event.pointerType === 'mouse') inspectedSlot.value = slot
}

function onClick(slot: number, card: SpellCard) {
  if (longPressed) {
    longPressed = false
    return
  }

  inspectedSlot.value = slot
  if (card.status === 'ready' || props.targeting?.slot === slot) emit('select', slot)
}
</script>

<style scoped>
.spell-bar {
  --spell-gap: clamp(0.35rem, 1.5vw, 0.7rem);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--spell-gap);
  container-type: inline-size;
}

.spell-slots {
  display: grid;
  grid-template-columns: repeat(v-bind('cards.length'), minmax(0, 1fr));
  gap: var(--spell-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.spell-slot {
  height: clamp(5.25rem, 22cqi, 6.75rem);
  margin: var(--px);
  outline: var(--px) dashed var(--ui-border-accented);
}

.spell-slot:has(.spell-card) {
  outline-color: transparent;
}

.spell-card {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.35rem 0.2rem 0.3rem;
  border: 0;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-highlighted);
  cursor: pointer;
  animation: spell-card-draw 420ms cubic-bezier(0.2, 0.75, 0.3, 1) both;
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
  transition: translate 0.15s ease;
}

.spell-card:disabled {
  cursor: default;
}

.spell-card:not(:disabled):hover,
.spell-card:focus-visible {
  --frame-color: var(--game-target);
  outline: none;
}

.spell-card--active {
  --frame-color: var(--game-target);
  --frame-extra: 0 0 0 calc(var(--px) * 2) color-mix(in srgb, var(--game-target) 35%, transparent);
  translate: 0 -0.3rem;
}

.spell-card-sprite {
  min-height: 0;
  flex: 1 1 0;
  aspect-ratio: 1;
  object-fit: contain;
  pointer-events: none;
  transition:
    filter 0.2s ease,
    opacity 0.2s ease;
}

.spell-card--unavailable .spell-card-sprite {
  filter: grayscale(0.85);
  opacity: 0.5;
}

.spell-card-name {
  display: grid;
  min-height: 2.2em;
  place-items: center;
  font-size: clamp(0.7rem, 3cqi, 0.85rem);
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.spell-card--unavailable .spell-card-name {
  color: var(--ui-text-muted);
}

.spell-cost {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  color: var(--game-gold-text);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
}

.spell-cost--short {
  color: var(--ui-color-error-500);
}

.spell-cost-icon {
  width: 1em;
  height: 1em;
  object-fit: contain;
}

.spell-card-cost {
  position: absolute;
  top: -0.4rem;
  right: -0.1rem;
  padding: 0.15rem 0.3rem;
  background: var(--ui-bg);
}

.spell-detail {
  display: flex;
  min-height: 6.6rem;
  flex-direction: column;
  justify-content: center;
  gap: 0.45rem;
  margin: var(--px);
  padding: 0.6rem 0.75rem;
  background: var(--ui-bg-elevated);
}

.spell-detail--targeting {
  --frame-color: var(--game-target);
}

.spell-detail-main {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spell-detail-sprite {
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  object-fit: contain;
}

.spell-detail-text {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.15rem;
}

.spell-detail p {
  margin: 0;
}

.spell-detail-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 700;
}

.spell-detail-description,
.spell-detail-hint,
.spell-detail-note {
  color: var(--ui-text-muted);
  font-size: 0.9rem;
  line-height: 1.25;
}

.spell-detail-hint,
.spell-detail-note {
  text-align: center;
}

.spell-detail-note,
.spell-detail-prompt {
  padding: 0.3rem 0.6rem;
}

.spell-detail-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: color-mix(in srgb, var(--game-target) 14%, transparent);
  color: var(--game-target);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
}

.spell-detail-prompt-icon {
  flex: 0 0 auto;
  font-size: 1rem;
}

.spell-detail-step {
  flex: 0 0 auto;
  opacity: 0.65;
}

.spell-detail-cancel {
  --button-color: var(--ui-bg);
  flex: 0 0 auto;
}

@keyframes spell-card-draw {
  from {
    opacity: 0;
    transform: perspective(600px) rotateY(180deg);
  }

  to {
    opacity: 1;
    transform: perspective(600px) rotateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spell-card {
    animation-duration: 1ms;
    transition: none;
  }
}
</style>
