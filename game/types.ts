import type { GameConfig } from './config'
import type { SPELL_IDS } from './configValidation'

export type Direction = 'up' | 'down' | 'left' | 'right'
export type Faction = 'player' | 'enemy' | 'neutral'
export type SpawnKind = 'friend' | 'enemy' | 'boss'
export type GameOverReason = 'board-full' | 'no-friendly-monsters'
export type SpellId = typeof SPELL_IDS[number]

export interface Monster {
  id: string
  faction: Faction
  typeId: string
  tier: number
  hp: number
  maxHp: number
  atk: number
  movable: boolean
  isBoss?: boolean
  /** Turns the monster stays frozen in place; absent when it is not frozen. */
  frozenTurns?: number
}

export interface SpawnEntry {
  kind: SpawnKind
  typeId: string
  tier: number
}

export interface GameState {
  config?: GameConfig
  width: number
  height: number
  cells: (Monster | null)[]
  turn: number
  score: number
  gold: number
  xp: number
  enemyTierUnlockTurn: number | null
  spawnQueue: SpawnEntry[]
  rngSeed: number
  spellSlots: (SpellId | null)[]
  spellRngSeed: number
  gameOver: boolean
  gameOverReason?: GameOverReason
}

export type GameEvent
  = | { type: 'move', monsterId: string, from: number, to: number }
    | { type: 'merge', sourceIds: [string, string], resultId: string, at: number }
    | { type: 'attack' | 'counter', attackerId: string, targetId: string, damage: number }
    | { type: 'death', monsterId: string, at: number }
    | { type: 'spawn', monsterId: string, at: number, kind: SpawnKind }
    | { type: 'gameOver', reason: GameOverReason }

export interface TurnResult {
  state: GameState
  stateAfterMovement?: GameState
  stateAfterActiveAttacks?: GameState
  stateBeforeSpawn?: GameState
  events: GameEvent[]
  valid: boolean
}
