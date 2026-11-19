<template>
  <section
    class="spawn-preview"
    aria-label="Spawn timeline"
  >
    <ol class="spawn-list">
      <li
        v-for="slot in slots"
        :key="slot.key"
        class="spawn-item"
        :class="slot.itemClass"
        :style="slot.style"
        :aria-label="slot.label"
        :aria-hidden="slot.isHidden || undefined"
      >
        <span
          class="spawn-tile"
          :class="slot.tileClass"
          aria-hidden="true"
        >
          <img
            class="spawn-sprite"
            :src="slot.sprite"
            alt=""
            draggable="false"
          >
          <span
            v-if="slot.isBoss"
            class="spawn-boss"
          >♛</span>
          <span class="spawn-level">{{ slot.tier }}</span>
        </span>
      </li>
    </ol>
    <div
      class="spawn-turn"
      aria-live="polite"
    >
      <img
        class="spawn-turn-arrows spawn-turn-arrows--left"
        :src="`${app.baseURL}sprites/ui/turn-arrows.png`"
        alt=""
        width="134"
        height="64"
      >
      <span class="spawn-turn-counter">
        <img
          class="spawn-turn-icon"
          :src="`${app.baseURL}sprites/ui/turn.png`"
          alt=""
          width="128"
          height="128"
        >
        <span class="spawn-turn-label">Turn</span>
        <span class="spawn-turn-value">{{ turn }}</span>
      </span>
      <img
        class="spawn-turn-arrows spawn-turn-arrows--right"
        :src="`${app.baseURL}sprites/ui/turn-arrows.png`"
        alt=""
        width="134"
        height="64"
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { getMonsterDefinition, getMonsterHeadSprite } from '~~/game/config'
import type { SpawnEntry } from '~~/game/types'

const SLOT_SCALES = [1.4, 1.0, 0.9, 0.8, 0.68, 0.56, 0.46, 0.36]
const CURVE_DEPTH = 0.02
const OVERLAP = 0.16
const VISIBLE_DISTANCE = 4
const RENDERED_DISTANCE = SLOT_SCALES.length - 1

const props = defineProps<{
  history: readonly SpawnEntry[]
  queue: readonly SpawnEntry[]
  turn: number
}>()
const { app } = useRuntimeConfig()

/** Distance from the middle of the timeline to the middle of a slot, in units of the largest slot. */
function getSlotCentre(distance: number): number {
  let centre = 0
  for (let step = 1; step <= distance; step++) {
    const inner = SLOT_SCALES[step - 1] ?? 0
    const outer = SLOT_SCALES[step] ?? 0
    centre += (inner + outer) / 2 - outer * OVERLAP
  }

  return centre
}

function getTimingLabel(offset: number): string {
  if (offset < 0) return offset === -1 ? '1 turn ago' : `${-offset} turns ago`
  if (offset === 0) return 'This turn'

  return offset === 1 ? 'In 1 turn' : `In ${offset} turns`
}

const slots = computed(() => {
  const current = props.history.length
  const items = []

  for (let offset = -RENDERED_DISTANCE; offset <= RENDERED_DISTANCE; offset++) {
    const spawn = offset < 0 ? props.history[current + offset] : props.queue[offset]
    if (!spawn) continue

    const distance = Math.abs(offset)
    const kindLabel = spawn.kind === 'friend' ? 'Ally' : spawn.kind === 'boss' ? 'Boss' : 'Enemy'

    items.push({
      key: current + offset,
      tier: spawn.tier,
      isBoss: spawn.kind === 'boss',
      isHidden: distance > VISIBLE_DISTANCE,
      itemClass: {
        'spawn-item--past': offset < 0,
        'spawn-item--current': offset === 0,
        'spawn-item--hidden': distance > VISIBLE_DISTANCE
      },
      tileClass: spawn.kind === 'friend' ? 'spawn-tile--friend' : 'spawn-tile--enemy',
      style: {
        '--spawn-scale': SLOT_SCALES[distance],
        '--spawn-x': Math.sign(offset) * getSlotCentre(distance),
        '--spawn-y': CURVE_DEPTH * distance ** 2,
        'z-index': RENDERED_DISTANCE - distance
      },
      sprite: `${app.baseURL}${getMonsterHeadSprite(spawn.typeId, spawn.tier).replace(/^\//, '')}`,
      label: `${getTimingLabel(offset)}: ${kindLabel}, ${getMonsterDefinition(spawn.typeId).name}, level ${spawn.tier}`
    })
  }

  return items
})
</script>

<style scoped>
.spawn-preview {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
  container-type: inline-size;
}

.spawn-list {
  --spawn-base: min(4rem, 14cqi);
  position: relative;
  height: calc(var(--spawn-base) * 1.2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.spawn-item {
  --spawn-size: calc(var(--spawn-base) * var(--spawn-scale));
  position: absolute;
  top: calc(var(--spawn-base) * (0.5 + var(--spawn-y)));
  left: calc(50% + var(--spawn-x) * var(--spawn-base));
  width: var(--spawn-size);
  height: var(--spawn-size);
  transform: translate(-50%, -50%);
  transition:
    top 0.4s ease,
    left 0.4s ease,
    width 0.4s ease,
    height 0.4s ease,
    opacity 0.4s ease,
    filter 0.4s ease;
}

.spawn-item--past {
  filter: grayscale(1);
}

.spawn-item--hidden {
  opacity: 0;
  pointer-events: none;
}

.spawn-tile {
  --spawn-colour: var(--game-enemy-strong);
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 2px solid color-mix(in srgb, var(--spawn-colour) 70%, transparent);
  border-radius: 50%;
  background: var(--game-enemy-bg);
  transition: box-shadow 0.4s ease;
}

.spawn-tile::after {
  position: absolute;
  border-radius: 50%;
  background: var(--ui-bg-elevated);
  content: "";
  inset: -2px;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.spawn-item--past .spawn-tile::after {
  opacity: 0.5;
}

.spawn-tile--friend {
  --spawn-colour: var(--game-accent-strong);
  background: var(--game-player-bg);
}

.spawn-item--current .spawn-tile {
  border-color: var(--spawn-colour);
  box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--spawn-colour) 30%, transparent);
}

.spawn-sprite {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  pointer-events: none;
}

.spawn-level,
.spawn-boss {
  position: absolute;
  z-index: 1;
  min-width: 1.5em;
  padding: 0 0.3em;
  border-radius: 999px;
  background: var(--spawn-colour);
  color: var(--ui-text-inverted);
  font-size: max(0.42rem, calc(var(--spawn-size) * 0.2));
  font-weight: 800;
  line-height: 1.5;
  text-align: center;
  transition:
    font-size 0.4s ease,
    background-color 0.4s ease;
}

.spawn-item--past .spawn-level {
  right: auto;
  left: -0.3em;
}

.spawn-item--past .spawn-boss {
  right: -0.3em;
  left: auto;
}

.spawn-item--past .spawn-level,
.spawn-item--past .spawn-boss {
  background: color-mix(in srgb, var(--spawn-colour) 50%, var(--ui-bg-elevated));
}

.spawn-level {
  right: -0.3em;
  bottom: -0.3em;
}

.spawn-boss {
  top: -0.3em;
  left: -0.3em;
}

.spawn-turn {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
  color: var(--game-turn-text);
}

.spawn-turn-counter {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.spawn-turn-arrows {
  width: auto;
  height: clamp(0.9rem, 5cqi, 1.3rem);
  pointer-events: none;
}

.spawn-turn-arrows--left {
  justify-self: start;
  transform: scaleX(-1);
}

.spawn-turn-arrows--right {
  justify-self: end;
}

.spawn-turn-icon {
  width: 1.35rem;
  height: 1.35rem;
  object-fit: contain;
}

.spawn-turn-label {
  font-size: 0.65rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  opacity: 0.8;
  text-transform: uppercase;
}

.spawn-turn-value {
  font-size: clamp(1.05rem, 4vw, 1.3rem);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1.2;
}

@media (prefers-reduced-motion: reduce) {
  .spawn-item,
  .spawn-tile,
  .spawn-tile::after,
  .spawn-level,
  .spawn-boss {
    transition: none;
  }
}
</style>
