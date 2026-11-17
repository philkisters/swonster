import { BOARD_HEIGHT, BOARD_WIDTH, getMonsterDefinition, getMonsterStats } from './config'
import { createSpawnQueue } from './spawning'
import type { GameState, Monster } from './types'

function createMonster(id: string, typeId: string): Monster {
  const stats = getMonsterStats(typeId, 1)
  const definition = getMonsterDefinition(typeId)

  return {
    id,
    faction: definition.faction,
    typeId,
    tier: 1,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    movable: true
  }
}

export function createInitialState(seed?: number): GameState {
  const cells: GameState['cells'] = Array(BOARD_WIDTH * BOARD_HEIGHT).fill(null)
  const spawnState = createSpawnQueue(seed)
  const place = (x: number, y: number, monster: Monster) => {
    cells[y * BOARD_WIDTH + x] = monster
  }

  place(0, 1, createMonster('player-dragon-1', 'dragon'))
  place(3, 1, createMonster('enemy-skeleton-dragon-1', 'skeletDragon'))
  place(0, 3, createMonster('player-griffin-1', 'griffin'))
  place(2, 3, createMonster('player-griffin-2', 'griffin'))
  place(1, 1, createMonster('enemy-skeleton-dragon-2', 'skeletDragon'))
  place(2, 1, createMonster('enemy-skeleton-dragon-3', 'skeletDragon'))
  place(3, 0, createMonster('enemy-skeleton-dragon-4', 'skeletDragon'))
  place(0, 2, createMonster('enemy-skeleton-dragon-5', 'skeletDragon'))

  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    cells,
    turn: 0,
    score: 0,
    gold: 0,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...spawnState
  }
}
