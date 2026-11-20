import { DEFAULT_GAME_CONFIG } from './config'
import { resolveCombat } from './combat'
import { slideAndMerge } from './movement'
import { spawnNextMonster } from './spawning'
import { refillSpellSlot } from './spellSlots'
import type { Direction, GameState, TurnResult } from './types'

export function executeTurn(state: GameState, direction: Direction): TurnResult {
  const config = state.config ?? DEFAULT_GAME_CONFIG
  if (state.gameOver) {
    return { state, events: [], valid: false }
  }

  const movement = slideAndMerge(state, direction)
  const combat = resolveCombat({
    ...state,
    cells: movement.cells
  }, direction)
  const valid = movement.events.length > 0 || combat.hpChanged

  if (!valid) {
    return { state, events: [], valid: false }
  }

  const rewards = combat.enemyDefeats
  const unlockedEnemyTiers = movement.events.some(event =>
    event.type === 'merge'
    && movement.cells[event.at]?.faction === 'player'
    && movement.cells[event.at]?.tier === config.enemyTierUnlockPlayerTier
  )
  const turn = state.turn + 1
  const stateAfterMovement: GameState = {
    ...state,
    cells: movement.cells,
    turn,
    score: state.score + movement.score,
    ...(turn % config.spellRefillInterval === 0 ? refillSpellSlot(state) : {}),
    enemyTierUnlockTurn: state.enemyTierUnlockTurn ?? (unlockedEnemyTiers ? state.turn + 1 : null)
  }
  const stateAfterActiveAttacks: GameState = {
    ...stateAfterMovement,
    cells: combat.cellsAfterActiveAttacks
  }
  const nextState: GameState = {
    ...stateAfterMovement,
    cells: combat.cells,
    score: stateAfterMovement.score + combat.enemyDefeatScore,
    gold: state.gold + config.enemyDefeatReward.gold * rewards,
    xp: state.xp + config.enemyDefeatReward.xp * rewards
  }
  if (nextState.cells.every(monster => monster !== null)) {
    return {
      state: {
        ...nextState,
        gameOver: true,
        gameOverReason: 'board-full'
      },
      stateAfterMovement,
      stateAfterActiveAttacks,
      stateBeforeSpawn: nextState,
      events: [...movement.events, ...combat.events, { type: 'gameOver', reason: 'board-full' }],
      valid: true
    }
  }

  const spawn = spawnNextMonster(nextState)
  const { event: spawnEvent, ...spawnState } = spawn
  const stateAfterSpawn: GameState = {
    ...nextState,
    ...spawnState
  }
  const noFriendlyMonsters = !stateAfterSpawn.cells.some(monster => monster?.faction === 'player')
  return {
    state: noFriendlyMonsters
      ? { ...stateAfterSpawn, gameOver: true, gameOverReason: 'no-friendly-monsters' }
      : stateAfterSpawn,
    stateAfterMovement,
    stateAfterActiveAttacks,
    stateBeforeSpawn: nextState,
    events: [
      ...movement.events,
      ...combat.events,
      spawnEvent,
      ...(noFriendlyMonsters
        ? [{ type: 'gameOver' as const, reason: 'no-friendly-monsters' as const }]
        : [])
    ],
    valid: true
  }
}
