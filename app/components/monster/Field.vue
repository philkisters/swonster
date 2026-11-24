<template>
  <div
    class="monster-field"
    :class="{
      'monster-field--player': monster.faction === 'player',
      'monster-field--enemy': monster.faction === 'enemy',
      'monster-field--frozen': isFrozen(monster),
    }"
    :style="{ '--hp-percent': `${hpPercent}%` }"
  >
    <img
      class="monster-sprite"
      :class="{ 'monster-sprite--mirrored': isMonsterSpriteMirrored(monster.tier) }"
      :src="withBaseURL(getMonsterSprite(monster.typeId, monster.tier, config))"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
    <div class="monster-health-fill" aria-hidden="true" />
    <template v-if="isFrozen(monster)">
      <img
        class="monster-frozen"
        :src="withBaseURL('/sprites/effects/frozen.png')"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
      <span class="monster-frozen-turns" aria-hidden="true">
        <UIcon name="lucide:snowflake" />
        {{ monster.frozenTurns }}
      </span>
    </template>
    <span class="monster-badge monster-badge--attack">
      <UIcon
        name="game-icons:swords-emblem"
        class="monster-icon bg-primary"
        aria-hidden="true"
      />
      <span class="monster-tier-value pt-1.5 pl-0.5">{{ monster.atk }}</span>
    </span>
    <span class="monster-badge monster-badge--level">
      <UIcon
        name="game-icons:round-star"
        class="monster-icon bg-warning"
        aria-hidden="true"
      />
      <span class="monster-tier-value pt-0.5 pr-0.5 text-inverted">{{ monster.tier }}</span>
    </span>
    <span class="monster-badge monster-badge--hp">
      <UIcon
        name="game-icons:hearts"
        class="monster-icon bg-error"
        aria-hidden="true"
      />
      <span class="monster-tier-value">{{ monster.hp }}</span>
    </span>
  </div>
</template>

<script lang="ts" setup>
import type { Monster } from '~~/game/types'
import { getMonsterSprite, isMonsterSpriteMirrored } from '~~/game/config'
import type { GameConfig } from '~~/game/config'
import { isFrozen } from '~~/game/freezing'

const { monster, config } = defineProps<{ monster: Monster, config?: GameConfig }>()
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
  border-radius: inherit;
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

.monster-sprite--mirrored {
  transform: scaleX(-1);
}

.monster-field--frozen .monster-sprite {
  filter: saturate(0.6) brightness(1.08);
}

.monster-frozen {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  animation: monster-freeze 320ms ease-out both;
}

.monster-frozen-turns {
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.15rem 0.35rem 0.15rem 0.25rem;
  border: 1px solid #1d5f9c;
  border-radius: 999px;
  background: #e4f7ff;
  color: #12305a;
  font-size: clamp(0.65rem, 1.8vw, 0.8rem);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  line-height: 1;
}

@keyframes monster-freeze {
  from {
    opacity: 0;
    scale: 1.15;
  }

  to {
    opacity: 1;
    scale: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .monster-frozen {
    animation: none;
  }
}

.monster-health-fill {
  position: absolute;
  margin: 0.1rem;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: linear-gradient(
    to top,
    var(--monster-border-color) 0 var(--hp-percent),
    transparent var(--hp-percent) 100%
  );
  pointer-events: none;
}

.monster-field--player {
  --monster-border-color: color-mix(
    in srgb,
    var(--ui-color-primary-500) 42%,
    var(--ui-border)
  );
}

.monster-field--enemy {
  --monster-border-color: color-mix(
    in srgb,
    var(--ui-color-warning-500) 42%,
    var(--ui-border)
  );
}

.monster-badge {
  position: absolute;
  display: flex;
  width: clamp(1.8rem, 5vw, 2.2rem);
  aspect-ratio: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: clamp(0.65rem, 1.8vw, 0.8rem);
  font-weight: 800;
  line-height: 1.4;
  white-space: nowrap;
  z-index: 2;
}

.monster-badge--attack {
  bottom: -0.4rem;
  left: -0.4rem;
}

.monster-badge--level {
  bottom: -0.4rem;
  left: 50%;
  transform: translateX(-50%);
}

.monster-badge--hp {
  bottom: -0.4rem;
  right: -0.4rem;
}

.monster-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1.25rem;
  height: 1.25rem;
  transform: translate(-50%, -50%);
  opacity: 0.85;
  pointer-events: none;
}

.monster-tier-value {
  position: relative;
  z-index: 4;
}

.monster-badge-label {
  font-size: 0.42rem;
  letter-spacing: 0.02em;
}

@media (min-width: 512px) {
  .monster-icon {
    width: 1.75rem;
    height: 1.75rem;
  }
}


@media (min-width: 768px) {
  .monster-icon {
    width: 2.25rem;
    height: 2.25rem;
  }
}
</style>
