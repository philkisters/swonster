import { isFrozen } from './freezing'
import { canMerge, mergeMonsters } from './merging'
import { getFriendlyMergeScore } from './config'
import type { Direction, GameEvent, GameState } from './types'

function getTraversalOrder(state: GameState, direction: Direction): number[] {
  const indices: number[] = []

  if (direction === 'left' || direction === 'right') {
    for (let y = 0; y < state.height; y++) {
      for (let step = 0; step < state.width; step++) {
        const x = direction === 'left' ? step : state.width - step - 1
        indices.push(y * state.width + x)
      }
    }
  } else {
    for (let step = 0; step < state.height; step++) {
      const y = direction === 'up' ? step : state.height - step - 1
      for (let x = 0; x < state.width; x++) {
        indices.push(y * state.width + x)
      }
    }
  }

  return indices
}

function getNextIndex(
  index: number,
  direction: Direction,
  width: number,
  height: number
): number | null {
  const x = index % width
  const y = Math.floor(index / width)

  if (direction === 'left') return x > 0 ? index - 1 : null
  if (direction === 'right') return x < width - 1 ? index + 1 : null
  if (direction === 'up') return y > 0 ? index - width : null
  return y < height - 1 ? index + width : null
}

export function slideAndMerge(
  state: GameState,
  direction: Direction
): { cells: GameState['cells'], events: GameEvent[], score: number } {
  const cells = [...state.cells]
  const events: GameEvent[] = []
  const mergedAt = new Set<number>()
  let mergeScore = 0

  for (const from of getTraversalOrder(state, direction)) {
    const monster = cells[from]
    if (!monster?.movable || isFrozen(monster)) continue

    cells[from] = null
    let destination = from
    let merged = false

    while (true) {
      const next = getNextIndex(destination, direction, state.width, state.height)
      if (next === null) break

      const blocker = cells[next]
      if (!blocker) {
        destination = next
        continue
      }

      if (!mergedAt.has(next) && canMerge(blocker, monster)) {
        const result = mergeMonsters(blocker, monster, state.turn + 1, next, state.config)
        cells[next] = result.monster
        if (monster.faction === 'player') {
          mergeScore += getFriendlyMergeScore(monster.tier, state.config)
        }
        mergedAt.add(next)
        if (from !== next) {
          events.push({ type: 'move', monsterId: monster.id, from, to: next })
        }
        events.push(result.event)
        merged = true
      }
      break
    }

    if (!merged) {
      cells[destination] = monster
      if (from !== destination) {
        events.push({ type: 'move', monsterId: monster.id, from, to: destination })
      }
    }
  }

  return { cells, events, score: mergeScore }
}
