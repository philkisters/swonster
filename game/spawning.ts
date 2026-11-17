import {
  DEFAULT_RNG_SEED,
  ENEMY_TIER_PROGRESSION,
  FRIEND_SPAWN_CHANCE,
  getMonsterDefinition,
  getMonsterStats,
  MONSTER_TYPES,
  SPAWN_QUEUE_LENGTH,
  SPAWN_TIER
} from './config'
import type { GameEvent, GameState, Monster, SpawnEntry, SpawnKind } from './types'

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}

export function nextSpawnEntry(seed: number, turnsSinceUnlock = 0): { entry: SpawnEntry, rngSeed: number } {
  let rngSeed = nextSeed(seed)
  const kind: SpawnKind = rngSeed / 0x100000000 < FRIEND_SPAWN_CHANCE ? 'friend' : 'enemy'
  rngSeed = nextSeed(rngSeed)
  const faction = kind === 'friend' ? 'player' : 'enemy'
  const typeIds = Object.entries(MONSTER_TYPES)
    .filter(([, definition]) => definition.faction === faction)
    .map(([typeId]) => typeId)
  const typeIndex = Math.floor(rngSeed / 0x100000000 * typeIds.length)
  const typeId = typeIds[typeIndex]
  if (!typeId) {
    throw new Error(`Cannot generate a ${faction} spawn without configured monster types`)
  }

  let tier: number = SPAWN_TIER
  if (kind === 'enemy' && turnsSinceUnlock > 0) {
    rngSeed = nextSeed(rngSeed)
    const roll = rngSeed / 0x100000000
    let threshold = 0
    for (const progression of ENEMY_TIER_PROGRESSION) {
      threshold += Math.min(turnsSinceUnlock * progression.chancePerTurn, progression.maxChance)
      if (roll < threshold) {
        tier = progression.tier
        break
      }
    }
  }

  return {
    entry: {
      kind,
      typeId,
      tier
    },
    rngSeed
  }
}

export function createSpawnQueue(seed = DEFAULT_RNG_SEED): {
  spawnQueue: SpawnEntry[]
  rngSeed: number
} {
  const spawnQueue: SpawnEntry[] = []
  let rngSeed = seed >>> 0

  for (let index = 0; index < SPAWN_QUEUE_LENGTH; index++) {
    const next = nextSpawnEntry(rngSeed)
    spawnQueue.push(next.entry)
    rngSeed = next.rngSeed
  }

  return { spawnQueue, rngSeed }
}

export function spawnNextMonster(state: GameState): {
  cells: GameState['cells']
  spawnQueue: SpawnEntry[]
  rngSeed: number
  event: Extract<GameEvent, { type: 'spawn' }>
} {
  const entry = state.spawnQueue[0]
  if (!entry) {
    throw new Error('Cannot spawn a monster without a spawn queue entry')
  }
  const definition = getMonsterDefinition(entry.typeId)
  const expectedFaction = entry.kind === 'friend' ? 'player' : 'enemy'
  if (definition.faction !== expectedFaction) {
    throw new Error(`Monster type ${entry.typeId} cannot spawn for faction ${expectedFaction}`)
  }

  const freeIndices = state.cells.flatMap((monster, index) => monster === null ? [index] : [])
  if (freeIndices.length === 0) {
    throw new Error('Cannot spawn a monster: the board has no free cell')
  }
  const positionSeed = nextSeed(state.rngSeed)
  const at = freeIndices[Math.floor(positionSeed / 0x100000000 * freeIndices.length)]
  if (at === undefined) {
    throw new Error('Cannot select a free cell for the spawn')
  }

  const stats = getMonsterStats(entry.typeId, entry.tier)
  const monster: Monster = {
    id: `spawn-${state.turn}`,
    faction: definition.faction,
    typeId: entry.typeId,
    tier: entry.tier,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    movable: true,
    ...(entry.kind === 'boss' ? { isBoss: true } : {})
  }
  const cells = [...state.cells]
  cells[at] = monster
  const turnsSinceUnlock = state.enemyTierUnlockTurn === null
    ? 0
    : state.turn - state.enemyTierUnlockTurn
  const next = nextSpawnEntry(positionSeed, turnsSinceUnlock)

  return {
    cells,
    spawnQueue: [...state.spawnQueue.slice(1), next.entry],
    rngSeed: next.rngSeed,
    event: { type: 'spawn', monsterId: monster.id, at, kind: entry.kind }
  }
}
