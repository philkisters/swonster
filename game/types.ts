export type Direction = 'up' | 'down' | 'left' | 'right'
export type Faction = 'player' | 'enemy'
export type SpawnKind = 'friend' | 'enemy' | 'boss'
export type GameOverReason = 'board-full' | 'no-friendly-monsters'

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
}

export interface SpawnEntry {
  kind: SpawnKind
  typeId: string
  tier: number
}

export interface GameState {
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
