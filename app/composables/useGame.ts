import { onScopeDispose, readonly, ref } from 'vue'
import { createInitialState } from '~~/game/initialState'
import { executeTurn } from '~~/game/engine'
import type { Direction, GameEvent, GameState } from '~~/game/types'

interface AttackAnimation {
  monsterId: string
  direction: Direction
  phase: 'attack' | 'counter'
}

interface PendingTurn {
  finalState: GameState
  stateAfterActiveAttacks: GameState
  activeAnimations: AttackAnimation[]
  counterAnimations: AttackAnimation[]
  hasSpawn: boolean
}

export function useGame() {
  const state = ref<GameState>(createInitialState())
  const attackAnimations = ref<AttackAnimation[]>([])
  const mergeAnimations = ref<string[]>([])
  const pendingTurn = ref<PendingTurn | null>(null)
  const animationPhase = ref<'merge' | 'merge-delay' | 'attack' | 'counter' | null>(null)
  const isAnimating = ref(false)
  let mergeDelay: ReturnType<typeof setTimeout> | undefined

  onScopeDispose(() => clearTimeout(mergeDelay))

  function move(direction: Direction) {
    if (isAnimating.value) return

    const result = executeTurn(state.value, direction)
    if (!result.valid) {
      attackAnimations.value = []
      return
    }

    const stateAfterActiveAttacks = result.stateAfterActiveAttacks
      ?? result.stateBeforeSpawn
      ?? result.state
    const activeAnimations = createAttackAnimations(
      result.events,
      'attack',
      direction,
      stateAfterActiveAttacks
    )
    const counterAnimations = createAttackAnimations(
      result.events,
      'counter',
      getOppositeDirection(direction),
      stateAfterActiveAttacks
    )
    pendingTurn.value = {
      finalState: result.state,
      stateAfterActiveAttacks,
      activeAnimations,
      counterAnimations,
      hasSpawn: result.events.some(event => event.type === 'spawn')
    }
    isAnimating.value = true
    mergeAnimations.value = result.events.flatMap(event => event.type === 'merge' ? [event.resultId] : [])

    if (mergeAnimations.value.length > 0 && (activeAnimations.length > 0 || counterAnimations.length > 0)) {
      if (!result.stateAfterMovement) {
        throw new Error('Missing movement state for merge animation')
      }
      state.value = result.stateAfterMovement
      animationPhase.value = 'merge'
    } else {
      startAttackAnimations()
    }
  }

  function finishMergeAnimations() {
    if (animationPhase.value !== 'merge') return

    animationPhase.value = 'merge-delay'
    mergeDelay = setTimeout(() => {
      mergeAnimations.value = []
      startAttackAnimations()
    }, 200)
  }

  function startAttackAnimations() {
    const pending = pendingTurn.value
    if (!pending) return

    if (pending.activeAnimations.length > 0) {
      state.value = pending.stateAfterActiveAttacks
      setAttackAnimations('attack', pending.activeAnimations)
    } else if (pending.counterAnimations.length > 0) {
      state.value = pending.stateAfterActiveAttacks
      setAttackAnimations('counter', pending.counterAnimations)
    } else {
      showSpawn()
    }
  }

  function finishAttackAnimations() {
    const pending = pendingTurn.value
    if (!pending) return

    if (animationPhase.value === 'attack' && pending.counterAnimations.length > 0) {
      setAttackAnimations('counter', pending.counterAnimations)
      return
    }

    showSpawn()
  }

  function finishSpawnAnimation() {
    pendingTurn.value = null
    isAnimating.value = false
  }

  function restart() {
    clearTimeout(mergeDelay)
    mergeDelay = undefined
    state.value = createInitialState()
    attackAnimations.value = []
    mergeAnimations.value = []
    pendingTurn.value = null
    animationPhase.value = null
    isAnimating.value = false
  }

  function showSpawn() {
    const pending = pendingTurn.value
    if (!pending) return

    state.value = pending.finalState
    attackAnimations.value = []
    animationPhase.value = null
    pendingTurn.value = null
    if (!pending.hasSpawn) {
      isAnimating.value = false
    }
  }

  function setAttackAnimations(phase: AttackAnimation['phase'], animations: AttackAnimation[]) {
    animationPhase.value = phase
    attackAnimations.value = animations
  }

  return {
    state: readonly(state),
    attackAnimations: readonly(attackAnimations),
    mergeAnimations: readonly(mergeAnimations),
    move,
    restart,
    finishMergeAnimations,
    finishAttackAnimations,
    finishSpawnAnimation
  }
}

function createAttackAnimations(
  events: GameEvent[],
  type: 'attack' | 'counter',
  direction: Direction,
  visibleState: GameState
): AttackAnimation[] {
  const visibleMonsterIds = new Set(
    visibleState.cells.flatMap(monster => monster ? [monster.id] : [])
  )

  return events.flatMap(event =>
    event.type === type && visibleMonsterIds.has(event.attackerId)
      ? [{ monsterId: event.attackerId, direction, phase: type }]
      : []
  )
}

function getOppositeDirection(direction: Direction): Direction {
  if (direction === 'up') return 'down'
  if (direction === 'down') return 'up'
  if (direction === 'left') return 'right'
  return 'left'
}
