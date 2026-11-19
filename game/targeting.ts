import type { GameState, Monster } from './types'

export type TargetKind = 'ownMonster' | 'enemyMonster' | 'anyMonster' | 'freeCell' | 'enemyLine'

/** One pick of the player: a single cell, or a whole row or column. */
export interface Target {
  shape: 'cell' | 'row' | 'column'
  index: number
}

/** One pick a spell asks for, in the order the player makes them. */
export interface TargetStep {
  kind: TargetKind
  prompt: string
  /** Narrows monster targets further; `picked` holds the monsters chosen in earlier steps. */
  accepts?: (monster: Monster, picked: Monster[]) => boolean
}

export interface TargetBoard {
  width: number
  height: number
  cells: readonly (Monster | null)[]
}

export function isSameTarget(first: Target, second: Target): boolean {
  return first.shape === second.shape && first.index === second.index
}

export function getTargetCells(board: Pick<GameState, 'width' | 'height'>, target: Target): number[] {
  if (target.shape === 'row') {
    return Array.from({ length: board.width }, (_, x) => target.index * board.width + x)
  }
  if (target.shape === 'column') {
    return Array.from({ length: board.height }, (_, y) => y * board.width + target.index)
  }

  return [target.index]
}

function getLines(board: TargetBoard): Target[] {
  return [
    ...Array.from({ length: board.height }, (_, index): Target => ({ shape: 'row', index })),
    ...Array.from({ length: board.width }, (_, index): Target => ({ shape: 'column', index }))
  ]
}

function matchesStep(step: TargetStep, monster: Monster | null, picked: Monster[]): boolean {
  if (step.kind === 'freeCell') return monster === null
  if (!monster) return false
  if (step.kind === 'ownMonster' && monster.faction !== 'player') return false
  if (step.kind === 'enemyMonster' && monster.faction !== 'enemy') return false

  return step.accepts?.(monster, picked) ?? true
}

function getCandidates(board: TargetBoard, step: TargetStep, chosen: Target[]): Target[] {
  if (step.kind === 'enemyLine') {
    return getLines(board).filter(line =>
      getTargetCells(board, line).some(index => board.cells[index]?.faction === 'enemy')
    )
  }

  const picked = chosen.flatMap(target => target.shape === 'cell' ? board.cells[target.index] ?? [] : [])

  return board.cells.flatMap((monster, index) => {
    const target: Target = { shape: 'cell', index }
    const alreadyChosen = chosen.some(other => isSameTarget(other, target))

    return !alreadyChosen && matchesStep(step, monster, picked) ? [target] : []
  })
}

function canComplete(board: TargetBoard, steps: TargetStep[], chosen: Target[]): boolean {
  const step = steps[chosen.length]
  if (!step) return true

  return getCandidates(board, step, chosen)
    .some(candidate => canComplete(board, steps, [...chosen, candidate]))
}

/** Lists what the player may pick next. Picks that would leave a later step without any target are left out. */
export function getTargetOptions(board: TargetBoard, steps: TargetStep[], chosen: Target[] = []): Target[] {
  const step = steps[chosen.length]
  if (!step) return []

  return getCandidates(board, step, chosen)
    .filter(candidate => canComplete(board, steps, [...chosen, candidate]))
}

export function hasTargets(board: TargetBoard, steps: TargetStep[]): boolean {
  return canComplete(board, steps, [])
}

export function isValidSelection(board: TargetBoard, steps: TargetStep[], targets: Target[]): boolean {
  return targets.length === steps.length
    && targets.every((target, step) =>
      getTargetOptions(board, steps, targets.slice(0, step)).some(option => isSameTarget(option, target))
    )
}
