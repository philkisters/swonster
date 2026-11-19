import type { Monster } from './types'

export interface HealthChange {
  cell: number
  amount: number
}

type Cells = readonly (Readonly<Monster> | null)[]

/**
 * Lists the HP each monster gained (positive) or lost (negative) between two boards.
 * A monster missing from the later board counts as defeated: it lost all its remaining HP
 * on the cell it stood on. Monsters whose maximum HP changed were transformed rather than
 * healed or hurt, and are left out.
 */
export function getHealthChanges(before: Cells, after: Cells): HealthChange[] {
  const cellById = new Map(after.flatMap((monster, cell) => monster ? [[monster.id, cell] as const] : []))

  return before.flatMap((monster, cell) => {
    if (!monster) return []

    const nextCell = cellById.get(monster.id)
    const next = nextCell === undefined ? null : after[nextCell]
    if (nextCell === undefined || !next) return [{ cell, amount: -monster.hp }]
    if (next.maxHp !== monster.maxHp || next.hp === monster.hp) return []

    return [{ cell: nextCell, amount: next.hp - monster.hp }]
  })
}
