import { describe, expect, it } from 'vitest'
import { getDirectionFromKey, getDirectionFromSwipe } from '../game/input'

describe('keyboard direction input', () => {
  it.each([
    ['ArrowUp', 'up'],
    ['w', 'up'],
    ['W', 'up'],
    ['ArrowDown', 'down'],
    ['s', 'down'],
    ['S', 'down'],
    ['ArrowLeft', 'left'],
    ['a', 'left'],
    ['A', 'left'],
    ['ArrowRight', 'right'],
    ['d', 'right'],
    ['D', 'right']
  ] as const)('maps %s to %s', (key, direction) => {
    expect(getDirectionFromKey(key)).toBe(direction)
  })

  it('ignores repeated and unrelated keys', () => {
    expect(getDirectionFromKey('ArrowUp', true)).toBeNull()
    expect(getDirectionFromKey('Enter')).toBeNull()
  })
})

describe('pointer swipe direction input', () => {
  it.each([
    [-31, 0, 'left'],
    [31, 0, 'right'],
    [0, -31, 'up'],
    [0, 31, 'down'],
    [40, 20, 'right'],
    [-20, 40, 'down']
  ] as const)('maps delta (%i, %i) to %s', (deltaX, deltaY, direction) => {
    expect(getDirectionFromSwipe(deltaX, deltaY)).toBe(direction)
  })

  it('requires the minimum swipe distance and supports a custom threshold', () => {
    expect(getDirectionFromSwipe(29, 0)).toBeNull()
    expect(getDirectionFromSwipe(30, 0)).toBe('right')
    expect(getDirectionFromSwipe(9, 0, 10)).toBeNull()
    expect(getDirectionFromSwipe(10, 0, 10)).toBe('right')
  })
})
