<template>
  <div
    class="game-board pixel-frame pixel-frame--raised"
    :class="{ 'game-board--targeting': targeting }"
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
      class="board-cell pixel-frame"
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
        'board-cell--attack-right': getAttackAnimation(monster)?.direction === 'right',
        'board-cell--targetable': targetableCells.has(index),
        'board-cell--chosen': chosenCells.has(index),
        'board-cell--dimmed': isDimmed(index),
        'board-cell--line-preview': previewCells.has(index)
      }"
      role="gridcell"
      :tabindex="targetableCells.has(index) ? 0 : undefined"
      :aria-label="monster
        ? `${getMonsterDefinition(monster.typeId).name}, ${monster.faction === 'player' ? 'Ally' : 'Enemy'}, tier ${monster.tier}, HP ${monster.hp} of ${monster.maxHp}, attack ${monster.atk}`
        : 'Empty'"
      @animationend="onAnimationEnd($event, monster)"
      @click="pickCell(index)"
      @keydown.enter.space.prevent="pickCell(index)"
    >
      <MonsterField v-if="monster" :monster="monster" />
      <PixelIcon
        v-else-if="targetableCells.has(index)"
        name="plus"
        class="board-cell-free"
      />
      <span
        v-if="chosenCells.has(index)"
        class="board-cell-order"
        aria-hidden="true"
      >{{ chosenCells.get(index) }}</span>
      <img
        v-if="spellEffect?.cells.includes(index)"
        :key="spellEffect.id"
        class="board-spell-burst"
        :src="spriteUrl(getSpellSprite(spellEffect.spellId))"
        alt=""
        draggable="false"
        @animationend.stop="emit('spellEffectDone')"
      >
    </div>
    <span
      v-for="popup in healthPopups"
      :key="popup.id"
      class="board-health-popup"
      :class="popup.amount > 0 ? 'board-health-popup--heal' : 'board-health-popup--damage'"
      :style="{ gridArea: getGridArea(popup.cell) }"
      aria-hidden="true"
      @animationend="emit('healthPopupDone', popup.id)"
    >{{ popup.amount > 0 ? `+${popup.amount}` : `−${-popup.amount}` }}</span>
    <button
      v-for="line in lineOptions"
      :key="`${line.shape}-${line.index}`"
      type="button"
      class="board-line-handle"
      :class="{
        'board-line-handle--row': line.shape === 'row',
        'board-line-handle--column': line.shape === 'column'
      }"
      :style="{ '--line': line.index }"
      :aria-label="`${line.shape === 'row' ? 'Row' : 'Column'} ${line.index + 1}`"
      @pointerenter="previewLine = line"
      @pointerleave="previewLine = null"
      @focus="previewLine = line"
      @blur="previewLine = null"
      @click="emit('pick', line)"
    >
      <PixelIcon name="chevrons" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { getMonsterDefinition } from '~~/game/config'
import { getDirectionFromSwipe } from '~~/game/input'
import { getSpellSprite } from '~~/game/spells'
import { getTargetCells, isSameTarget } from '~~/game/targeting'
import type { Target } from '~~/game/targeting'
import type { Direction, Monster, SpellId } from '~~/game/types'

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

interface Targeting {
  options: readonly Target[]
  chosen: readonly Target[]
}

interface SpellEffect {
  id: number
  spellId: SpellId
  cells: readonly number[]
}

interface HealthPopup {
  id: number
  cell: number
  amount: number
}

const props = defineProps<{
  state: BoardState
  attackAnimations: readonly AttackAnimation[]
  mergeAnimations: readonly string[]
  targeting?: Targeting | null
  spellEffect?: SpellEffect | null
  healthPopups?: readonly HealthPopup[]
}>()
const emit = defineEmits<{
  move: [direction: Direction]
  pick: [target: Target]
  spellEffectDone: []
  healthPopupDone: [id: number]
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
const spriteUrl = useSpriteUrl()
const previewLine = ref<Target | null>(null)

const targetableCells = computed(() => new Set(getCellIndices(props.targeting?.options)))
const chosenCells = computed(() => new Map(
  getCellIndices(props.targeting?.chosen).map((index, order) => [index, order + 1] as const)
))
const lineOptions = computed(() => props.targeting?.options.filter(target => target.shape !== 'cell') ?? [])
const previewCells = computed(() => {
  const line = lineOptions.value.find(option => previewLine.value && isSameTarget(option, previewLine.value))

  return new Set(line ? getTargetCells(props.state, line) : [])
})

function getCellIndices(targets: readonly Target[] = []): number[] {
  return targets.flatMap(target => target.shape === 'cell' ? [target.index] : [])
}

function getGridArea(index: number): string {
  const column = index % props.state.width + 1
  const row = Math.floor(index / props.state.width) + 1

  return `${row} / ${column} / ${row + 1} / ${column + 1}`
}

function isDimmed(index: number): boolean {
  return targetableCells.value.size > 0
    && !targetableCells.value.has(index)
    && !chosenCells.value.has(index)
}

function pickCell(index: number) {
  if (targetableCells.value.has(index) || chosenCells.value.has(index)) {
    emit('pick', { shape: 'cell', index })
  }
}

watch(
  () => `${props.state.turn}:${props.attackAnimations.map(({ monsterId, phase }) => `${phase}-${monsterId}`).join('|')}`,
  () => completedAttackers.clear()
)

watch(() => props.state.turn, () => completedMerges.clear())

function getAttackAnimation(monster: Monster | null): AttackAnimation | undefined {
  return monster ? attackAnimationsByMonster.value.get(monster.id) : undefined
}

function onPointerDown(event: PointerEvent) {
  if (props.targeting) return
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

<style scoped>
.game-board {
  --board-gap: clamp(6px, 2vw, 12px);
  display: grid;
  grid-template-columns: repeat(var(--board-width), minmax(0, 1fr));
  grid-template-rows: repeat(var(--board-height), minmax(0, 1fr));
  gap: var(--board-gap);
  position: relative;
  aspect-ratio: 1;
  margin: var(--px);
  padding: var(--board-gap);
  background: var(--ui-bg-accented);
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
  --frame-color: var(--ui-border);
  overflow: visible;
  background: var(--ui-bg);
  color: var(--ui-text-highlighted);
}

.board-cell:hover {
  z-index: 2;
}

.board-cell--player {
  --frame-color: var(--game-accent-strong);
  background: var(--game-player-bg);
}

.board-cell--enemy {
  --frame-color: var(--game-enemy-strong);
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

.board-cell {
  transition:
    opacity 0.2s ease,
    filter 0.2s ease;
}

.board-cell--dimmed {
  filter: grayscale(0.7);
  opacity: 0.4;
}

.board-cell--targetable,
.board-cell--chosen {
  z-index: 1;
  cursor: pointer;
  outline: none;
}

.board-cell--targetable::after,
.board-cell--chosen::after,
.board-cell--line-preview::after {
  position: absolute;
  z-index: 3;
  border: var(--px) solid var(--game-target);
  content: "";
  inset: calc(var(--px) * -1);
  pointer-events: none;
}

.board-cell--targetable::after {
  animation: board-target-pulse 1.1s ease-in-out infinite;
}

.board-cell--targetable:hover::after,
.board-cell--targetable:focus-visible::after {
  background: color-mix(in srgb, var(--game-target) 22%, transparent);
  animation: none;
}

.board-cell--chosen::after {
  background: color-mix(in srgb, var(--game-target) 22%, transparent);
}

.board-cell--line-preview::after {
  border-width: 0;
  background: color-mix(in srgb, var(--game-target) 28%, transparent);
  inset: 0;
}

.board-cell-free {
  width: 40%;
  height: 40%;
  color: var(--game-target);
  opacity: 0.75;
}

.board-cell-order {
  position: absolute;
  top: -0.45rem;
  left: -0.45rem;
  z-index: 4;
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  background: var(--game-target);
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--ui-bg),
    0 var(--px) 0 0 var(--ui-bg),
    calc(var(--px) * -1) 0 0 0 var(--ui-bg),
    var(--px) 0 0 0 var(--ui-bg);
  color: var(--ui-bg);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1;
}

.board-spell-burst {
  position: absolute;
  z-index: 5;
  width: 84%;
  height: 84%;
  inset: 8%;
  object-fit: contain;
  pointer-events: none;
  animation: board-spell-burst 560ms ease-out both;
}

.board-health-popup {
  position: absolute;
  z-index: 2;
  display: grid;
  place-items: center;
  inset: 0;
  font-size: clamp(1.3rem, 7vw, 2.25rem);
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
  text-shadow:
    0.08em 0 0 var(--ui-bg),
    -0.08em 0 0 var(--ui-bg),
    0 0.08em 0 var(--ui-bg),
    0 -0.08em 0 var(--ui-bg),
    0.08em 0.08em 0 var(--ui-bg),
    -0.08em 0.08em 0 var(--ui-bg),
    0.08em -0.08em 0 var(--ui-bg),
    -0.08em -0.08em 0 var(--ui-bg);
  animation: board-health-popup 1000ms ease-out both;
}

.board-health-popup--damage {
  color: var(--game-damage-text);
}

.board-health-popup--heal {
  color: var(--game-heal-text);
}

.board-line-handle {
  --line-centre: calc(
    var(--board-gap) * (var(--line) + 1)
    + (100% - var(--board-gap) * (var(--line-count) + 1)) / var(--line-count) * (var(--line) + 0.5)
  );
  position: absolute;
  z-index: 4;
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 0;
  background: var(--game-target);
  box-shadow:
    0 calc(var(--px) * -1) 0 0 var(--ui-bg),
    0 var(--px) 0 0 var(--ui-bg),
    calc(var(--px) * -1) 0 0 0 var(--ui-bg),
    var(--px) 0 0 0 var(--ui-bg);
  color: var(--ui-bg);
  font-size: 1.25rem;
  cursor: pointer;
  transform: translate(-50%, -50%);
  animation: board-handle-pulse 1.1s ease-in-out infinite;
}

.board-line-handle:hover,
.board-line-handle:focus-visible {
  outline: none;
  animation: none;
  scale: 1.2;
}

.board-line-handle--row {
  --line-count: var(--board-height);
  top: var(--line-centre);
  left: 0;
}

.board-line-handle--column {
  --line-count: var(--board-width);
  top: 0;
  left: var(--line-centre);
}

.board-line-handle--column .pixel-icon {
  rotate: 90deg;
}

@keyframes board-target-pulse {
  0%, 100% {
    opacity: 1;
    scale: 1;
  }

  50% {
    opacity: 0.45;
    scale: 1.05;
  }
}

@keyframes board-handle-pulse {
  0%, 100% {
    scale: 1;
  }

  50% {
    scale: 1.18;
  }
}

@keyframes board-health-popup {
  0% {
    opacity: 0;
    scale: 0.5;
    translate: 0 10%;
  }

  15% {
    opacity: 1;
    scale: 1.2;
    translate: 0 -5%;
  }

  30% {
    scale: 1;
  }

  65% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    scale: 1;
    translate: 0 -65%;
  }
}

@keyframes board-health-popup-fade {
  0%, 60% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@keyframes board-spell-burst {
  0% {
    opacity: 0;
    scale: 0.4;
  }

  25%, 65% {
    opacity: 1;
    scale: 1;
  }

  100% {
    opacity: 0;
    scale: 1.35;
  }
}

.board-cell:hover .monster-tooltip {
  transform: translate(-50%, 0);
  opacity: 1;
  visibility: visible;
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

  .board-cell--targetable::after,
  .board-line-handle {
    animation: none;
  }

  .board-spell-burst {
    animation-duration: 1ms;
  }

  .board-health-popup {
    animation-name: board-health-popup-fade;
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
