import { DEFAULT_GAME_CONFIG, getMonsterDefinition, getMonsterStats, getMonsterTypeIds } from './config'
import type { GameConfig } from './config'
import { createSpawnQueue } from './spawning'
import { createSpellSlots, refillSpellSlot } from './spellSlots'
import { chooseRunSeed, nextSeed } from './rng'
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
  const playerTypeIds = getMonsterTypeIds('player', config)
  const enemyTypeIds = getMonsterTypeIds('enemy', config)
  if (!playerTypeIds.length || (config.startingEnemyMonsterCount > 0 && !enemyTypeIds.length)) {
    throw new Error('Cannot create initial monsters without configured monster types for each faction')
  }

  const totalStartingMonsters = config.startingPlayerMonsterCount + config.startingEnemyMonsterCount
  if (totalStartingMonsters > cells.length) {
    throw new Error('Starting monsters do not fit on the board')
  }

  let placementSeed = initialSeed >>> 0
  const randomIndex = (length: number) => {
    placementSeed = nextSeed(placementSeed)
    return Math.floor(placementSeed / 0x100000000 * length)
  }
  const availableCells = cells.map((_, index) => index)
  for (let index = availableCells.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1)
    const current = availableCells[index]!
    availableCells[index] = availableCells[swapIndex]!
    availableCells[swapIndex] = current
  }

  const startingGroups = [
    { faction: 'player', count: config.startingPlayerMonsterCount, typeIds: playerTypeIds },
    { faction: 'enemy', count: config.startingEnemyMonsterCount, typeIds: enemyTypeIds }
  ] as const
  let placementIndex = 0
  for (const { faction, count, typeIds } of startingGroups) {
    for (let index = 0; index < count; index++) {
      const typeId = typeIds[randomIndex(typeIds.length)]
      const at = availableCells[placementIndex]
      if (!typeId || at === undefined) {
        throw new Error(`Cannot place starting ${faction} monster`)
      }
      cells[at] = createMonster(`${faction}-start-${index + 1}`, typeId, config)
      placementIndex++
    }
  }

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
    ...refillSpellSlot(createSpellSlots(initialSeed, config), config)
  }
}
