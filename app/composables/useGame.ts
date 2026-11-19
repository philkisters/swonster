import { onScopeDispose, readonly, ref } from 'vue'
import { createInitialState } from '~~/game/initialState'
import { executeTurn } from '~~/game/engine'
import { getHealthChanges } from '~~/game/healthChanges'
import type { HealthChange } from '~~/game/healthChanges'
import { castSpell } from '~~/game/spells'
import { getTargetCells } from '~~/game/targeting'
import type { Target } from '~~/game/targeting'
import type { Direction, GameEvent, GameState, SpawnEntry, SpellId } from '~~/game/types'

interface AttackAnimation {
  monsterId: string
  direction: Direction
  phase: 'attack' | 'counter'
}

interface SpellEffect {
  id: number
  spellId: SpellId
  cells: number[]
}

interface HealthPopup extends HealthChange {
  id: number
}

interface PendingTurn {
  finalState: GameState
  stateAfterActiveAttacks: GameState
  activeAnimations: AttackAnimation[]
  counterAnimations: AttackAnimation[]
  activeHealthChanges: HealthChange[]
  counterHealthChanges: HealthChange[]
  spawnedEntry: SpawnEntry | null
}

const HEALTH_SPELLS: ReadonlySet<SpellId> = new Set(['fireball', 'fireballBarrage', 'heal'])

export function useGame() {
  const state = ref<GameState>(createInitialState())
  const spawnHistory = ref<SpawnEntry[]>(createSpawnHistory(state.value))
  const attackAnimations = ref<AttackAnimation[]>([])
  const mergeAnimations = ref<string[]>([])
  const pendingTurn = ref<PendingTurn | null>(null)
  const animationPhase = ref<'merge' | 'merge-delay' | 'attack' | 'counter' | null>(null)
  const isAnimating = ref(false)
  const spellEffect = ref<SpellEffect | null>(null)
  const healthPopups = ref<HealthPopup[]>([])
  let mergeDelay: ReturnType<typeof setTimeout> | undefined
  let spellCasts = 0
  let healthPopupCount = 0

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
      activeHealthChanges: getHealthChanges(
        (result.stateAfterMovement ?? stateAfterActiveAttacks).cells,
        stateAfterActiveAttacks.cells
      ),
      counterHealthChanges: getHealthChanges(stateAfterActiveAttacks.cells, result.state.cells),
      spawnedEntry: result.events.some(event => event.type === 'spawn')
        ? state.value.spawnQueue[0] ?? null
        : null
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

    const phase = pending.activeAnimations.length > 0
      ? 'attack'
      : pending.counterAnimations.length > 0 ? 'counter' : null
    if (!phase) {
      showSpawn()
      return
    }

    state.value = pending.stateAfterActiveAttacks
    showHealthChanges(pending.activeHealthChanges)
    setAttackAnimations(phase, phase === 'attack' ? pending.activeAnimations : pending.counterAnimations)
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

  function cast(slot: number, targets: Target[]) {
    if (isAnimating.value) return

    const spellId = state.value.spellSlots[slot]
    const result = castSpell(state.value, slot, targets)
    if (!result.valid || !spellId) return

    spellEffect.value = {
      id: ++spellCasts,
      spellId,
      cells: targets.flatMap(target => getTargetCells(state.value, target))
    }
    if (HEALTH_SPELLS.has(spellId)) {
      showHealthChanges(getHealthChanges(state.value.cells, result.state.cells))
    }
    state.value = result.state
  }

  function finishSpellEffect() {
    spellEffect.value = null
  }

  function showHealthChanges(changes: HealthChange[]) {
    healthPopups.value = [
      ...healthPopups.value,
      ...changes.map(change => ({ ...change, id: ++healthPopupCount }))
    ]
  }

  function finishHealthPopup(id: number) {
    healthPopups.value = healthPopups.value.filter(popup => popup.id !== id)
  }

  function restart() {
    clearTimeout(mergeDelay)
    mergeDelay = undefined
    state.value = createInitialState()
    spawnHistory.value = createSpawnHistory(state.value)
    attackAnimations.value = []
    mergeAnimations.value = []
    pendingTurn.value = null
    animationPhase.value = null
    isAnimating.value = false
    spellEffect.value = null
    healthPopups.value = []
  }

  function showSpawn() {
    const pending = pendingTurn.value
    if (!pending) return

    state.value = pending.finalState
    showHealthChanges(pending.counterHealthChanges)
    attackAnimations.value = []
    animationPhase.value = null
    pendingTurn.value = null
    if (pending.spawnedEntry) {
      spawnHistory.value = [...spawnHistory.value, pending.spawnedEntry]
    } else {
      isAnimating.value = false
    }
  }

  function setAttackAnimations(phase: AttackAnimation['phase'], animations: AttackAnimation[]) {
    animationPhase.value = phase
    attackAnimations.value = animations
  }

  return {
    state: readonly(state),
    spawnHistory: readonly(spawnHistory),
    attackAnimations: readonly(attackAnimations),
    mergeAnimations: readonly(mergeAnimations),
    spellEffect: readonly(spellEffect),
    healthPopups: readonly(healthPopups),
    isAnimating: readonly(isAnimating),
    move,
    cast,
    restart,
    finishMergeAnimations,
    finishAttackAnimations,
    finishSpawnAnimation,
    finishSpellEffect,
    finishHealthPopup
  }
}

/**
 * Lists the monsters already on the board as if they had spawned on earlier turns,
 * enemies first, so the timeline has a past to show at the start of a game.
 */
function createSpawnHistory(state: GameState): SpawnEntry[] {
  const monsters = state.cells.flatMap(monster => monster ? [monster] : [])

  return [
    ...monsters.filter(monster => monster.faction === 'enemy'),
    ...monsters.filter(monster => monster.faction === 'player')
  ].map(monster => ({
    kind: monster.isBoss ? 'boss' : monster.faction === 'player' ? 'friend' : 'enemy',
    typeId: monster.typeId,
    tier: monster.tier
  }))
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
