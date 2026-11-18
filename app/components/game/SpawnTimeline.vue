<script setup lang="ts">
import { computed } from 'vue'
import { getMonsterDefinition, getMonsterHeadSprite } from '../../../game/config'
import type { SpawnEntry } from '../../../game/types'

const VISIBLE_SPAWNS = 9

const props = defineProps<{ queue: readonly SpawnEntry[] }>()
const { app } = useRuntimeConfig()

const spawns = computed(() => props.queue.slice(0, VISIBLE_SPAWNS).map((spawn, index) => {
  const position = index + 1
  const kindLabel = spawn.kind === 'friend' ? 'Ally' : spawn.kind === 'boss' ? 'Boss' : 'Enemy'

  return {
    position,
    tier: spawn.tier,
    isBoss: spawn.kind === 'boss',
    tileClass: spawn.kind === 'friend' ? 'spawn-tile--friend' : 'spawn-tile--enemy',
    sprite: `${app.baseURL}${getMonsterHeadSprite(spawn.typeId, spawn.tier).replace(/^\//, '')}`,
    label: `${position}: ${kindLabel}, ${getMonsterDefinition(spawn.typeId).name}, level ${spawn.tier}`
  }
}))
</script>

<template>
  <section
    class="spawn-preview"
    aria-label="Upcoming monster spawns"
  >
    <ol class="spawn-list">
      <li
        v-for="spawn in spawns"
        :key="spawn.position"
        :aria-label="spawn.label"
      >
        <span
          class="spawn-tile"
          :class="spawn.tileClass"
          aria-hidden="true"
        >
          <img
            class="spawn-sprite"
            :src="spawn.sprite"
            alt=""
            draggable="false"
          >
          <span
            v-if="spawn.isBoss"
            class="spawn-boss"
          >♛</span>
          <span class="spawn-level">{{ spawn.tier }}</span>
        </span>
        <span
          class="spawn-number"
          aria-hidden="true"
        >{{ spawn.position }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.spawn-preview {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
  container-type: inline-size;
}

.spawn-preview h2 {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.56rem;
  font-weight: 850;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.spawn-list {
  display: flex;
  justify-content: space-between;
  gap: clamp(0.2rem, 1cqi, 0.35rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.spawn-list li {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
}

.spawn-tile {
  --spawn-colour: var(--game-enemy-strong);
  position: relative;
  display: grid;
  width: clamp(1.5rem, 9.5cqi, 3rem);
  height: clamp(1.5rem, 9.5cqi, 3rem);
  place-items: center;
  border: 2px solid color-mix(in srgb, var(--spawn-colour) 70%, transparent);
  border-radius: 50%;
  background: var(--game-enemy-bg);
}

.spawn-tile--friend {
  --spawn-colour: var(--game-accent-strong);
  background: var(--game-player-bg);
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
  min-width: 1.5em;
  padding: 0 0.3em;
  border-radius: 999px;
  background: var(--spawn-colour);
  color: var(--ui-text-inverted);
  font-size: clamp(0.42rem, 2.1cqi, 0.62rem);
  font-weight: 800;
  line-height: 1.5;
  text-align: center;
}

.spawn-level {
  right: -0.45em;
  bottom: -0.45em;
}

.spawn-boss {
  top: -0.45em;
  left: -0.45em;
}

.spawn-number {
  color: var(--ui-text-muted);
  font-size: 0.6rem;
  font-weight: 750;
  line-height: 1;
}
</style>
