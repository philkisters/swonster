import { getMonsterStats } from './config'
import type { GameEvent, Monster } from './types'

export function canMerge(first: Monster, second: Monster): boolean {
  return first.movable
    && second.movable
    && first.faction === second.faction
    && first.typeId === second.typeId
    && first.tier === second.tier
}

export function mergeMonsters(
  first: Monster,
  second: Monster,
  turn: number,
  at: number
): { monster: Monster, event: GameEvent } {
  if (!canMerge(first, second)) {
    throw new Error('Cannot merge incompatible monsters')
  }

  const tier = first.tier + 1
  const stats = getMonsterStats(first.typeId, tier)
  const sourceIds: [string, string] = [first.id, second.id]
  const stableIds = [...sourceIds].sort()
  const resultId = `merge-${turn}-${stableIds[0]}-${stableIds[1]}`

  return {
    monster: {
      id: resultId,
      faction: first.faction,
      typeId: first.typeId,
      tier,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      movable: true
    },
    event: {
      type: 'merge',
      sourceIds,
      resultId,
      at
    }
  }
}
