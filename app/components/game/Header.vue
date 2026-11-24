<template>
  <header class="game-header">
    <h1 class="game-header-brand">
      <img
        class="game-logo"
        :src="`${app.baseURL}logo.png`"
        alt="Swonster"
        width="512"
        height="512"
      >
    </h1>

    <div
      class="game-counters pixel-frame"
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
        <img
          class="game-counter-icon"
          :src="`${app.baseURL}sprites/ui/${counter.key}.png`"
          alt=""
          width="192"
          height="192"
        >
        <span class="game-counter-label">{{ counter.label }}</span>
        <span class="game-counter-value">{{ counter.value }}</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const props = defineProps<{
  score: number
  gold: number
  xp: number
}>()

const { app } = useRuntimeConfig()

const counters = computed(() => [
  { key: 'score', class: 'game-counter--score', label: 'Score', value: props.score },
  { key: 'gold', class: 'game-counter--gold', label: 'Gold', value: props.gold },
  { key: 'xp', class: 'game-counter--xp', label: 'XP', value: props.xp }
])
</script>

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
  width: clamp(4rem, 20vw, 6rem);
  height: clamp(4rem, 20vw, 6rem);
  object-fit: contain;
}

.game-counters {
  display: grid;
  min-width: 0;
  grid-template-columns: auto auto minmax(3ch, auto);
  gap: 0.15rem 0.6rem;
  margin: var(--px);
  padding: 0.4rem 0.7rem;
  background: var(--ui-bg-elevated);
}

.game-counter {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}

.game-counter-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
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
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.8;
  text-transform: uppercase;
}

.game-counter-value {
  font-size: clamp(1.2rem, 4.5vw, 1.5rem);
  justify-self: end;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.1;
}
</style>
