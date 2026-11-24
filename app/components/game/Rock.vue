<template>
  <div class="board-rock">
    <img
      class="board-rock-sprite"
      :src="spriteUrl(getSpellSprite('rock'))"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
    <svg
      class="board-rock-cracks"
      viewBox="0 0 256 256"
      aria-hidden="true"
    >
      <g
        v-for="(paths, stage) in visibleCracks"
        :key="stage"
        class="board-rock-crack"
      >
        <path
          v-for="path in paths"
          :key="`edge-${path}`"
          class="board-rock-crack-edge"
          :d="path"
          pathLength="1"
        />
        <path
          v-for="path in paths"
          :key="path"
          class="board-rock-crack-line"
          :d="path"
          pathLength="1"
        />
      </g>
    </svg>
  </div>
</template>

<script lang="ts" setup>
import { getSpellSprite } from '~~/game/spells'
import type { Monster } from '~~/game/types'

/** Crack lines drawn on the rock sprite, one group per hit it has taken. */
const CRACKS = [
  ['M130 34 L120 66 L136 96 L122 130 L132 152'],
  ['M120 66 L92 82 L78 112 L56 122', 'M132 152 L118 178 L128 204'],
  ['M136 96 L166 106 L184 92 L210 104', 'M122 130 L96 144 L88 172', 'M128 204 L120 226'],
  ['M166 106 L176 138 L200 156 L204 190', 'M78 112 L70 146 L42 164', 'M176 138 L156 168 L166 198', 'M92 82 L74 62']
]

const { rock } = defineProps<{ rock: Pick<Monster, 'hp' | 'maxHp'> }>()
const spriteUrl = useSpriteUrl()

const visibleCracks = computed(() => {
  const damage = (rock.maxHp - rock.hp) / Math.max(1, rock.maxHp - 1)

  return CRACKS.slice(0, Math.ceil(Math.min(1, damage) * CRACKS.length))
})
</script>

<style scoped>
.board-rock {
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.board-rock-sprite,
.board-rock-cracks {
  position: absolute;
  inset: 6%;
  width: 88%;
  height: 88%;
  pointer-events: none;
}

.board-rock-sprite {
  object-fit: contain;
}

.board-rock-cracks {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.board-rock-crack path {
  stroke-dasharray: 1;
  animation: board-rock-crack 260ms ease-out both;
}

.board-rock-crack-edge {
  stroke: #f2f4f7;
  stroke-opacity: 0.55;
  stroke-width: 3;
  translate: 3px 2px;
}

.board-rock-crack-line {
  stroke: #2e1206;
  stroke-width: 6;
}

@keyframes board-rock-crack {
  from {
    stroke-dashoffset: 1;
  }

  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-rock-crack path {
    animation: none;
  }
}
</style>
