import type { Direction } from './types'

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right'
}

export function getDirectionFromKey(key: string, repeated = false): Direction | null {
  if (repeated) return null

  return KEY_DIRECTIONS[key] ?? null
}

export function getDirectionFromSwipe(
  deltaX: number,
  deltaY: number,
  threshold = 30
): Direction | null {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return null

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX < 0 ? 'left' : 'right'
  }

  return deltaY < 0 ? 'up' : 'down'
}
