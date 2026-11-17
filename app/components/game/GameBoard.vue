<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getMonsterDefinition, getMonsterSprite } from '../../../game/config'
import { getDirectionFromSwipe } from '../../../game/input'
import type { Direction, Monster } from '../../../game/types'

interface BoardState {
  width: number
  height: number
  cells: readonly (Readonly<Monster> | null)[]
  turn: number
}

interface AttackAnimation {
  monsterId: string
  direction: Direction
  phase: 'attack' | 'counter'
}

const props = defineProps<{
  state: BoardState
  attackAnimations: readonly AttackAnimation[]
  mergeAnimations: readonly string[]
}>()
const emit = defineEmits<{
  move: [direction: Direction]
  attackAnimationsDone: []
  mergeAnimationsDone: []
  spawnAnimationDone: []
}>()

const attackAnimationsByMonster = computed(() => new Map(
  props.attackAnimations.map(animation => [animation.monsterId, animation] as const)
))
const completedAttackers = new Set<string>()
const completedMerges = new Set<string>()
const mergedMonsterIds = computed(() => new Set(props.mergeAnimations))
const pointerStart = ref<{ id: number, x: number, y: number } | null>(null)
const { app } = useRuntimeConfig()

watch(
  () => `${props.state.turn}:${props.attackAnimations.map(({ monsterId, phase }) => `${phase}-${monsterId}`).join('|')}`,
  () => completedAttackers.clear()
)

watch(() => props.state.turn, () => completedMerges.clear())

function getAttackAnimation(monster: Monster | null): AttackAnimation | undefined {
  return monster ? attackAnimationsByMonster.value.get(monster.id) : undefined
}

function withBaseURL(path: string): string {
  return `${app.baseURL}${path.replace(/^\//, '')}`
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  pointerStart.value = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY
  }
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }
}

function onPointerUp(event: PointerEvent) {
  const start = pointerStart.value
  pointerStart.value = null
  if (!start || start.id !== event.pointerId) return

  const deltaX = event.clientX - start.x
  const deltaY = event.clientY - start.y
  const direction = getDirectionFromSwipe(deltaX, deltaY)
  if (!direction) return
  emit('move', direction)
}

function onPointerCancel() {
  pointerStart.value = null
}

function onAnimationEnd(event: AnimationEvent, monster: Monster | null) {
  const cell = event.currentTarget
  if (!(cell instanceof HTMLElement) || event.target !== cell) return

  if (event.animationName === 'swonster-merge-pop' && monster && mergedMonsterIds.value.has(monster.id)) {
    completedMerges.add(monster.id)
    if (props.mergeAnimations.every(id => completedMerges.has(id))) {
      emit('mergeAnimationsDone')
    }
    return
  }

  if (cell.classList.contains('board-cell--spawned')) {
    if (event.animationName !== 'swonster-spawn-card-flip') return
    emit('spawnAnimationDone')
    return
  }

  if (
    event.animationName !== 'swonster-attack-bump'
    || !cell.classList.contains('board-cell--attacking')
    || !monster
  ) return

  completedAttackers.add(monster.id)
  if (props.attackAnimations.every(attack => completedAttackers.has(attack.monsterId))) {
    emit('attackAnimationsDone')
  }
}
</script>

<template>
  <div
    class="game-board"
    role="grid"
    :aria-label="`${state.width} by ${state.height} monster game board`"
    :style="{ '--board-width': state.width, '--board-height': state.height }"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div
      v-for="(monster, index) in state.cells"
      :key="getAttackAnimation(monster)
        ? `${index}-${monster?.id}-${getAttackAnimation(monster)?.phase}-${state.turn}`
        : monster?.id === `spawn-${state.turn}` || monster?.id.startsWith(`merge-${state.turn}-`)
          ? `${index}-${monster.id}` : index"
      class="board-cell"
      :class="{
        'board-cell--player': monster?.faction === 'player',
        'board-cell--enemy': monster?.faction === 'enemy',
        'board-cell--spawned': monster?.id === `spawn-${state.turn}`,
        'board-cell--merged': monster && mergedMonsterIds.has(monster.id),
        'board-cell--attacking': getAttackAnimation(monster) !== undefined,
        'board-cell--countering': getAttackAnimation(monster)?.phase === 'counter',
        'board-cell--attack-up': getAttackAnimation(monster)?.direction === 'up',
        'board-cell--attack-down': getAttackAnimation(monster)?.direction === 'down',
        'board-cell--attack-left': getAttackAnimation(monster)?.direction === 'left',
        'board-cell--attack-right': getAttackAnimation(monster)?.direction === 'right'
      }"
      role="gridcell"
      :aria-label="monster
        ? `${getMonsterDefinition(monster.typeId).name}, ${monster.faction === 'player' ? 'Ally' : 'Enemy'}, tier ${monster.tier}, HP ${monster.hp} of ${monster.maxHp}, attack ${monster.atk}`
        : 'Empty'"
      @animationend="onAnimationEnd($event, monster)"
    >
      <template v-if="monster">
        <img
          class="monster-sprite"
          :src="withBaseURL(getMonsterSprite(monster.typeId, monster.tier))"
          alt=""
          aria-hidden="true"
          draggable="false"
        >
        <div class="monster-name">
          <span>Lvl. {{ monster.tier }}</span>
        </div>
        <div class="monster-stats">
          <span class="monster-stat monster-stat--hp">HP {{ monster.hp }}</span>
          <span class="monster-stat monster-stat--attack">ATK {{ monster.atk }}</span>
        </div>
        <div
          class="monster-tooltip"
          aria-hidden="true"
        >
          <span>{{ getMonsterDefinition(monster.typeId).name }}</span>
          <span>HP {{ monster.hp }} / {{ monster.maxHp }}</span>
        </div>
      </template>
      <span
        v-else
        class="empty-mark"
        aria-hidden="true"
      >·</span>
    </div>
  </div>
</template>

<style scoped>
.game-board {
  --board-gap: clamp(0.35rem, 1.5vw, 0.7rem);
  display: grid;
  grid-template-columns: repeat(var(--board-width), minmax(0, 1fr));
  grid-template-rows: repeat(var(--board-height), minmax(0, 1fr));
  gap: var(--board-gap);
  width: min(100%, 34rem);
  aspect-ratio: 1;
  padding: var(--board-gap);
  border: 1px solid var(--ui-border-accented);
  border-radius: 1.5rem;
  background: var(--ui-bg-accented);
  box-shadow: 0 1.5rem 4rem rgb(40 50 32 / 12%);
  touch-action: none;
  user-select: none;
}

.board-cell {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.18rem;
  padding-bottom: 0.85rem;
  overflow: visible;
  border: 1px solid var(--ui-border-muted);
  border-radius: 0.9rem;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
}

.board-cell:hover {
  z-index: 2;
}

.board-cell--player {
  border-color: color-mix(in srgb, var(--ui-color-primary-500) 42%, var(--ui-border));
  background: var(--game-player-bg);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ui-color-primary-500) 10%, transparent);
}

.board-cell--enemy {
  border-color: color-mix(in srgb, var(--ui-color-warning-500) 42%, var(--ui-border));
  background: var(--game-enemy-bg);
}

.board-cell--spawned {
  animation: swonster-spawn-card-flip 520ms cubic-bezier(0.2, 0.75, 0.3, 1) both;
  backface-visibility: hidden;
}

.board-cell--attacking {
  z-index: 1;
  animation: swonster-attack-bump var(--attack-duration, 180ms) ease-in-out var(--attack-delay, 0ms) both;
}

.board-cell--countering {
  --attack-duration: 300ms;
  --attack-delay: 200ms;
}

.board-cell--merged {
  z-index: 1;
  animation: swonster-merge-pop 300ms ease-in-out both;
}

.board-cell--attack-up {
  --attack-x: 0;
  --attack-y: calc(-100% - var(--board-gap));
}

.board-cell--attack-down {
  --attack-x: 0;
  --attack-y: calc(100% + var(--board-gap));
}

.board-cell--attack-left {
  --attack-x: calc(-100% - var(--board-gap));
  --attack-y: 0;
}

.board-cell--attack-right {
  --attack-x: calc(100% + var(--board-gap));
  --attack-y: 0;
}

.monster-sprite {
  width: clamp(2.5rem, 10vw, 4.5rem);
  max-width: 65%;
  height: clamp(2.5rem, 10vw, 4.5rem);
  max-height: 65%;
  object-fit: contain;
  pointer-events: none;
}

.monster-name {
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(0.55rem, 1.9vw, 0.75rem);
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monster-stats {
  position: absolute;
  right: 0.2rem;
  bottom: 0.2rem;
  left: 0.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.1rem;
}

.monster-stat {
  min-width: 0;
  padding: 0.12rem 0.22rem;
  border-radius: 999px;
  font-size: clamp(0.42rem, 1.25vw, 0.56rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 2;
  white-space: nowrap;
}

.monster-stat--hp {
  background: color-mix(in srgb, var(--ui-color-success-500) 20%, var(--ui-bg-elevated));
  color: var(--game-accent-text);
}

.monster-stat--attack {
  background: var(--ui-bg-accented);
  color: var(--ui-text-toned);
}

.monster-tooltip {
  position: absolute;
  bottom: calc(100% + 0.35rem);
  left: 50%;
  z-index: 2;
  display: flex;
  width: max-content;
  max-width: min(12rem, 80vw);
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.4rem 0.6rem;
  transform: translate(-50%, 0.25rem);
  border: 1px solid var(--ui-border-inverted);
  border-radius: 0.55rem;
  background: var(--ui-bg-inverted);
  box-shadow: 0 0.4rem 1rem rgb(20 30 20 / 25%);
  color: var(--ui-text-inverted);
  font-size: 0.68rem;
  line-height: 1.2;
  opacity: 0;
  pointer-events: none;
  text-align: center;
  transition: opacity 120ms ease, transform 120ms ease, visibility 120ms;
  visibility: hidden;
}

.board-cell:hover .monster-tooltip {
  transform: translate(-50%, 0);
  opacity: 1;
  visibility: visible;
}

.empty-mark {
  color: var(--ui-text-dimmed);
  font-size: 1.5rem;
}

@media (max-width: 480px) {
  .game-board {
    border-radius: 1rem;
  }

  .board-cell {
    border-radius: 0.65rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .board-cell--spawned,
  .board-cell--attacking {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }

  .board-cell--merged {
    animation-duration: 1ms;
    animation-delay: 0ms;
  }
}
</style>

<style>
/* Completion handlers need names that Vue's scoped CSS compiler won't rewrite. */
@keyframes swonster-merge-pop {
  0%, 100% {
    scale: 1;
  }

  50% {
    scale: 1.12;
  }
}

@keyframes swonster-attack-bump {
  0%, 100% {
    transform: translate(0, 0);
  }

  45% {
    transform: translate(var(--attack-x), var(--attack-y));
  }
}

@keyframes swonster-spawn-card-flip {
  from {
    opacity: 0;
    transform: perspective(600px) rotateY(180deg);
  }

  to {
    opacity: 1;
    transform: perspective(600px) rotateY(0);
  }
}
</style>
