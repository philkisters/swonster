<template>
  <div
    class="monster-field"
    :class="{
      'monster-field--player': monster.faction === 'player',
      'monster-field--enemy': monster.faction === 'enemy',
    }"
    :style="{ '--hp-percent': `${hpPercent}%` }"
  >
    <img
      class="monster-sprite"
      :src="withBaseURL(getMonsterSprite(monster.typeId, monster.tier))"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
    <div class="monster-health-fill" aria-hidden="true" />
    <span class="monster-badge monster-badge--attack">
      <PixelIcon name="sword" class="monster-icon text-primary" />
      <span class="monster-badge-value">{{ monster.atk }}</span>
    </span>
    <span class="monster-badge monster-badge--level">
      <PixelIcon name="star" class="monster-icon text-warning" />
      <span class="monster-badge-value">{{ monster.tier }}</span>
    </span>
    <span class="monster-badge monster-badge--hp">
      <PixelIcon name="heart" class="monster-icon text-error" />
      <span class="monster-badge-value">{{ monster.hp }}</span>
    </span>
  </div>
</template>

<script lang="ts" setup>
import type { Monster } from '~~/game/types'
import { getMonsterSprite } from '~~/game/config'

const { monster } = defineProps<{ monster: Monster }>()
const { app } = useRuntimeConfig()

const hpPercent = computed(() => {
  if (monster.maxHp <= 0) return 0
  return Math.max(0, Math.min(100, (monster.hp / monster.maxHp) * 100))
})

function withBaseURL(path: string): string {
  return `${app.baseURL}${path.replace(/^\//, '')}`
}
</script>

<style>
.monster-field {
  position: absolute;
  inset: 0;
}

.monster-sprite {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.monster-health-fill {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    to top,
    var(--monster-health-color) 0 var(--hp-percent),
    transparent var(--hp-percent) 100%
  );
  pointer-events: none;
}

.monster-field--player {
  --monster-health-color: color-mix(
    in srgb,
    var(--ui-color-primary-500) 42%,
    var(--ui-border)
  );
}

.monster-field--enemy {
  --monster-health-color: color-mix(
    in srgb,
    var(--ui-color-warning-500) 42%,
    var(--ui-border)
  );
}

.monster-badge {
  --badge-size: 24px;
  position: absolute;
  bottom: calc(var(--badge-size) * -0.3);
  z-index: 2;
  display: grid;
  width: var(--badge-size);
  height: var(--badge-size);
  place-items: center;
}

.monster-badge--attack {
  left: calc(var(--badge-size) * -0.25);
}

.monster-badge--level {
  left: calc(50% - var(--badge-size) / 2);
}

.monster-badge--hp {
  right: calc(var(--badge-size) * -0.25);
}

.monster-badge .monster-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.monster-badge-value {
  position: relative;
  color: #fff;
  font-size: calc(var(--badge-size) * 0.55);
  font-weight: 700;
  line-height: 1;
  text-shadow:
    1px 0 0 #17171f,
    -1px 0 0 #17171f,
    0 1px 0 #17171f,
    0 -1px 0 #17171f,
    1px 1px 0 #17171f,
    -1px 1px 0 #17171f,
    1px -1px 0 #17171f,
    -1px -1px 0 #17171f;
  white-space: nowrap;
}

@media (min-width: 640px) {
  .monster-badge {
    --badge-size: 36px;
  }
}
</style>
