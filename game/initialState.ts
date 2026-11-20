import { DEFAULT_GAME_CONFIG, getMonsterDefinition, getMonsterStats } from './config'
import type { GameConfig } from './config'
import { createSpawnQueue } from './spawning'
import { createSpellSlots, refillSpellSlot } from './spellSlots'
import { chooseRunSeed } from './rng'
import type { GameState, Monster } from './types'

function createMonster(id: string, typeId: string, config: GameConfig): Monster {
  const stats = getMonsterStats(typeId, 1, config)
  const definition = getMonsterDefinition(typeId, config)

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

export function createInitialState(seed?: number, config: GameConfig = DEFAULT_GAME_CONFIG): GameState {
  const initialSeed = seed ?? chooseRunSeed(config.rngSeed)
  const cells: GameState['cells'] = Array(config.boardWidth * config.boardHeight).fill(null)
  const spawnState = createSpawnQueue(initialSeed, config)
  const place = (x: number, y: number, monster: Monster) => {
    cells[y * config.boardWidth + x] = monster
  }

  place(0, 1, createMonster('player-dragon-1', 'dragon', config))
  place(3, 3, createMonster('enemy-skeleton-dragon-1', 'skeletDragon', config))

  return {
    config,
    width: config.boardWidth,
    height: config.boardHeight,
    cells,
    turn: 0,
    score: 0,
    gold: 0,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...spawnState,
    ...refillSpellSlot(createSpellSlots(initialSeed, config))
  }
}
