<template>
  <header class="game-header">
    <UIcon name="i-lucide-chevron-left" class="size-8 shrink-0 cursor-pointer hover:bg-primary rounded" @click="$emit('end-game')" />
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
        <img
          class="game-counter-icon"
          :src="`${app.baseURL}sprites/ui/${counter.key}.png`"
          alt=""
          width="128"
          height="128"
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

defineEmits<{
  (event: 'end-game'): void
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

.game-counters {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.2rem clamp(0.6rem, 3vw, 1.25rem);
}

.game-counter {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.game-counter-icon {
  width: clamp(1.35rem, 5vw, 1.6rem);
  height: clamp(1.35rem, 5vw, 1.6rem);
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

@media (max-width: 480px) {
  .game-counter-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
