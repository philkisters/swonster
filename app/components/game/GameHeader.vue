<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  turn: number
  score: number
  gold: number
  xp: number
}>()

const { app } = useRuntimeConfig()

const counters = computed(() => [
  { key: 'turn', class: 'game-counter--turn', label: 'Turn', value: props.turn },
  { key: 'score', class: 'game-counter--score', label: 'Score', value: props.score },
  { key: 'gold', class: 'game-counter--gold', label: 'Gold', value: props.gold },
  { key: 'xp', class: 'game-counter--xp', label: 'XP', value: props.xp }
])
</script>

<template>
  <header class="game-header">
    <h1 class="game-header-brand">
      <img
        class="game-logo"
        :src="`${app.baseURL}logo.png`"
        alt="Swonster"
        width="80"
        height="80"
      >
    </h1>

    <div
      class="game-counters"
      role="group"
      aria-label="Game stats"
      aria-live="polite"
    >
      <div
        v-for="counter in counters"
        :key="counter.key"
        class="game-counter"
        :class="counter.class"
      >
        <span class="game-counter-label">{{ counter.label }}</span>
        <span class="game-counter-value">{{ counter.value }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.game-header-brand {
  flex: 0 0 auto;
  margin: 0;
}

.game-logo {
  display: block;
  width: clamp(4rem, 16vw, 5rem);
  height: clamp(4rem, 16vw, 5rem);
  border: 2px solid color-mix(in srgb, var(--ui-color-warning-400) 65%, var(--ui-border));
  border-radius: 1.15rem;
  box-shadow:
    0 0.75rem 2rem color-mix(in srgb, var(--ui-color-primary-950) 18%, transparent),
    0 0 0 0.25rem color-mix(in srgb, var(--ui-color-warning-500) 8%, transparent);
  object-fit: cover;
}

.game-counters {
  display: grid;
  min-width: 0;
  grid-template-columns: auto auto;
  gap: 0.1rem 0.6rem;
}

.game-counter {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: baseline;
  justify-items: end;
}

.game-counter--turn {
  color: var(--game-turn-text);
}

.game-counter--score {
  color: var(--game-score-text);
}

.game-counter--gold {
  color: var(--game-gold-text);
}

.game-counter--xp {
  color: var(--game-xp-text);
}

.game-counter-label {
  font-size: 0.65rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  opacity: 0.8;
  text-transform: uppercase;
}

.game-counter-value {
  font-size: clamp(1.05rem, 4vw, 1.3rem);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1.2;
}
</style>
