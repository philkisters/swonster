import type { GameState, Monster } from './types'

export const FREEZE_TURNS = 3

export function isFrozen(monster: Pick<Monster, 'frozenTurns'>): boolean {
  return (monster.frozenTurns ?? 0) > 0
}

/** Freezes a monster in place for the next FREEZE_TURNS turns. */
export function freezeMonster(monster: Monster): Monster {
  return { ...monster, frozenTurns: FREEZE_TURNS }
}

/** Takes one turn off every freeze on the board; a monster whose freeze runs out can slide again. */
export function thawCells(cells: GameState['cells']): GameState['cells'] {
  return cells.map((monster) => {
    if (!monster || !isFrozen(monster)) return monster

    const { frozenTurns = 0, ...thawed } = monster

    return frozenTurns > 1 ? { ...thawed, frozenTurns: frozenTurns - 1 } : thawed
  })
}
