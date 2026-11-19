import { describe, expect, it } from 'vitest'
import { getTargetCells, getTargetOptions, hasTargets, isValidSelection } from '../game/targeting'
import type { Target, TargetBoard, TargetStep } from '../game/targeting'
import type { Faction, Monster } from '../game/types'

function createMonster(id: string, faction: Faction, overrides: Partial<Monster> = {}): Monster {
  return { id, faction, typeId: 'dragon', tier: 1, hp: 8, maxHp: 8, atk: 2, movable: true, ...overrides }
}

function createBoard(monsters: [number, Monster][]): TargetBoard {
  const cells: TargetBoard['cells'] = Array(9).fill(null)
  const board = { width: 3, height: 3, cells: [...cells] }
  for (const [index, monster] of monsters) {
    board.cells[index] = monster
  }

  return board
}

const cell = (index: number): Target => ({ shape: 'cell', index })

describe('target options', () => {
  const board = createBoard([
    [0, createMonster('ally', 'player')],
    [4, createMonster('ally-2', 'player', { tier: 2 })],
    [5, createMonster('enemy', 'enemy')]
  ])

  it('offers monsters by faction and free cells', () => {
    expect(getTargetOptions(board, [{ kind: 'ownMonster', prompt: '' }])).toEqual([cell(0), cell(4)])
    expect(getTargetOptions(board, [{ kind: 'enemyMonster', prompt: '' }])).toEqual([cell(5)])
    expect(getTargetOptions(board, [{ kind: 'anyMonster', prompt: '' }])).toEqual([cell(0), cell(4), cell(5)])
    expect(getTargetOptions(board, [{ kind: 'freeCell', prompt: '' }])).toHaveLength(6)
  })

  it('offers only rows and columns that contain an enemy', () => {
    expect(getTargetOptions(board, [{ kind: 'enemyLine', prompt: '' }])).toEqual([
      { shape: 'row', index: 1 },
      { shape: 'column', index: 2 }
    ])
    expect(getTargetCells(board, { shape: 'row', index: 1 })).toEqual([3, 4, 5])
    expect(getTargetCells(board, { shape: 'column', index: 2 })).toEqual([2, 5, 8])
  })

  it('never offers a cell that was already picked', () => {
    const steps: TargetStep[] = [{ kind: 'anyMonster', prompt: '' }, { kind: 'anyMonster', prompt: '' }]

    expect(getTargetOptions(board, steps, [cell(0)])).toEqual([cell(4), cell(5)])
  })

  it('leaves out picks that make a later step impossible', () => {
    const sameTier: TargetStep[] = [
      { kind: 'ownMonster', prompt: '' },
      { kind: 'ownMonster', prompt: '', accepts: (monster, [first]) => monster.tier === first?.tier }
    ]

    expect(getTargetOptions(board, sameTier)).toEqual([])
    expect(hasTargets(board, sameTier)).toBe(false)

    const withPartner = createBoard([
      [0, createMonster('ally', 'player')],
      [4, createMonster('ally-2', 'player', { tier: 2 })],
      [8, createMonster('ally-3', 'player')]
    ])
    expect(getTargetOptions(withPartner, sameTier)).toEqual([cell(0), cell(8)])
    expect(getTargetOptions(withPartner, sameTier, [cell(0)])).toEqual([cell(8)])
  })

  it('validates a complete selection step by step', () => {
    const steps: TargetStep[] = [{ kind: 'ownMonster', prompt: '' }, { kind: 'freeCell', prompt: '' }]

    expect(isValidSelection(board, steps, [cell(0), cell(1)])).toBe(true)
    expect(isValidSelection(board, steps, [cell(0)])).toBe(false)
    expect(isValidSelection(board, steps, [cell(5), cell(1)])).toBe(false)
    expect(isValidSelection(board, steps, [cell(0), cell(4)])).toBe(false)
  })
})
