<template>
  <section
    class="spawn-preview"
    aria-label="Upcoming monster spawns"
  >
    <h2>Upcoming spawns</h2>
    <ol class="spawn-list">
      <li
        v-for="(spawn, index) in queue"
        :key="index"
        :aria-label="`${index + 1}: ${spawn.kind === 'friend' ? 'Ally' : spawn.kind === 'boss' ? 'Boss' : 'Enemy'}, ${spawn.typeId}, tier ${spawn.tier}`"
      >
        <span
          class="spawn-dot"
          :class="spawn.kind === 'friend' ? 'spawn-dot--friend' : 'spawn-dot--enemy'"
          aria-hidden="true"
        >
          <span v-if="spawn.kind === 'boss'">♛</span>
          <span v-else-if="spawn.tier > 1">{{ spawn.tier }}</span>
        </span>
        <span class="spawn-number">{{ index + 1 }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { SpawnEntry } from '~~/game/types'

defineProps<{ queue: readonly SpawnEntry[] }>()
</script>

<style scoped>
.spawn-preview {
  display: grid;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
  container-type: inline-size;
}

.spawn-preview h2 {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.spawn-list {
  display: flex;
  justify-content: space-between;
  gap: clamp(0.2rem, 1vw, 0.35rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.spawn-list li {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
}

.spawn-dot {
  display: grid;
  width: clamp(1rem, 7cqi, 1.65rem);
  height: clamp(1rem, 7cqi, 1.65rem);
  place-items: center;
  border-radius: 50%;
  color: var(--ui-text-inverted);
  font-size: 0.85rem;
  font-weight: 800;
}

.spawn-dot--friend {
  background: var(--game-accent-strong);
}

.spawn-dot--enemy {
  background: var(--game-enemy-strong);
}

.spawn-number {
  color: var(--ui-text-muted);
  font-size: 0.6rem;
  font-weight: 750;
}
</style>
