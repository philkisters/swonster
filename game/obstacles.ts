import type { Monster } from './types'

export const ROCK_TYPE_ID = 'rock'
export const ROCK_HITS = 5
export const OBSTACLE_HIT_DAMAGE = 1

/** Whether a board piece is a neutral obstacle rather than a monster that fights for a side. */
export function isObstacle(piece: Pick<Monster, 'faction'>): boolean {
  return piece.faction === 'neutral'
}

/** Creates a rock: it never slides, blocks every monster and breaks after ROCK_HITS hits. */
export function createRock(id: string): Monster {
  return {
    id,
    faction: 'neutral',
    typeId: ROCK_TYPE_ID,
    tier: 1,
    hp: ROCK_HITS,
    maxHp: ROCK_HITS,
    atk: 0,
    movable: false
  }
}
