import {
  ENEMY_DEFEAT_REWARD,
  ENEMY_TIER_UNLOCK_PLAYER_TIER,
  getEnemyDefeatScore,
  getFriendlyMergeScore,
  getMonsterStats,
  getMonsterTypeIds
} from './config'
import { getTargetCells, isValidSelection } from './targeting'
import type { Target, TargetStep } from './targeting'
import type { GameState, Monster, SpellId } from './types'

export const FIREBALL_DAMAGE = 6
export const FIREBALL_BARRAGE_DAMAGE = 3

export interface SpellDefinition {
  name: string
  description: string
  cost: number
  targets: TargetStep[]
  cast: (state: GameState, ...targets: Target[]) => GameState
}

export interface SpellResult {
  state: GameState
  valid: boolean
}

function fireball(state: GameState, target: Target): GameState {
  return damageEnemies(state, [target.index], FIREBALL_DAMAGE)
}

function fireballBarrage(state: GameState, line: Target): GameState {
  return damageEnemies(state, getTargetCells(state, line), FIREBALL_BARRAGE_DAMAGE)
}

function move(state: GameState, from: Target, to: Target): GameState {
  return withCells(state, [from.index, null], [to.index, monsterAt(state, from)])
}

function swap(state: GameState, first: Target, second: Target): GameState {
  return withCells(
    state,
    [first.index, monsterAt(state, second)],
    [second.index, monsterAt(state, first)]
  )
}

function typeChange(state: GameState, target: Target): GameState {
  const monster = monsterAt(state, target)
  const typeId = getNextPlayerType(monster.typeId)
  const { maxHp, atk } = getMonsterStats(typeId, monster.tier)
  const hp = Math.max(1, Math.round(maxHp * monster.hp / monster.maxHp))

  return withCells(state, [target.index, { ...monster, typeId, maxHp, atk, hp }])
}

function fusion(state: GameState, base: Target, material: Target): GameState {
  const monster = monsterAt(state, base)

  return withCells(
    { ...state, score: state.score + getFriendlyMergeScore(monster.tier) },
    [base.index, raiseTier(monster)],
    [material.index, null]
  )
}

function convertEnemy(state: GameState, target: Target): GameState {
  return withCells(state, [target.index, { ...monsterAt(state, target), faction: 'player' }])
}

function heal(state: GameState, target: Target): GameState {
  const monster = monsterAt(state, target)

  return withCells(state, [target.index, { ...monster, hp: monster.maxHp }])
}

function evolve(state: GameState, target: Target): GameState {
  return withCells(state, [target.index, raiseTier(monsterAt(state, target))])
}

export const SPELLS: Record<SpellId, SpellDefinition> = {
  fireball: {
    name: 'Fireball',
    description: `Deals ${FIREBALL_DAMAGE} damage to one enemy.`,
    cost: 2,
    targets: [{ kind: 'enemyMonster', prompt: 'Pick an enemy to burn' }],
    cast: fireball
  },
  fireballBarrage: {
    name: 'Fireball Barrage',
    description: `Deals ${FIREBALL_BARRAGE_DAMAGE} damage to every enemy in a row or column.`,
    cost: 4,
    targets: [{ kind: 'enemyLine', prompt: 'Pick a row or column to bombard' }],
    cast: fireballBarrage
  },
  move: {
    name: 'Move',
    description: 'Moves one of your monsters to any free cell.',
    cost: 1,
    targets: [
      { kind: 'ownMonster', prompt: 'Pick one of your monsters' },
      { kind: 'freeCell', prompt: 'Pick a free cell to move it to' }
    ],
    cast: move
  },
  swap: {
    name: 'Swap',
    description: 'Swaps the places of two of your monsters.',
    cost: 1,
    targets: [
      { kind: 'ownMonster', prompt: 'Pick one of your monsters' },
      { kind: 'ownMonster', prompt: 'Pick another of your monsters to swap with' }
    ],
    cast: swap
  },
  superMove: {
    name: 'Super Move',
    description: 'Moves any monster, friend or foe, to any free cell.',
    cost: 2,
    targets: [
      { kind: 'anyMonster', prompt: 'Pick any monster' },
      { kind: 'freeCell', prompt: 'Pick a free cell to move it to' }
    ],
    cast: move
  },
  superSwap: {
    name: 'Super Swap',
    description: 'Swaps the places of any two monsters, friend or foe.',
    cost: 3,
    targets: [
      { kind: 'anyMonster', prompt: 'Pick any monster' },
      { kind: 'anyMonster', prompt: 'Pick another monster to swap with' }
    ],
    cast: swap
  },
  typeChange: {
    name: 'Type Change',
    description: 'Turns one of your monsters into another type of the same level.',
    cost: 1,
    targets: [{ kind: 'ownMonster', prompt: 'Pick one of your monsters to transform' }],
    cast: typeChange
  },
  fusion: {
    name: 'Fusion',
    description: 'Fuses two of your monsters of the same level into the next level. The first pick sets the type.',
    cost: 4,
    targets: [
      { kind: 'ownMonster', prompt: 'Pick the monster that grows' },
      {
        kind: 'ownMonster',
        prompt: 'Pick a same-level monster to fuse into it',
        accepts: (monster, [base]) => monster.tier === base?.tier
      }
    ],
    cast: fusion
  },
  convertEnemy: {
    name: 'Convert Enemy',
    description: 'Turns one enemy into a monster of yours.',
    cost: 5,
    targets: [{ kind: 'enemyMonster', prompt: 'Pick an enemy to win over' }],
    cast: convertEnemy
  },
  heal: {
    name: 'Heal',
    description: 'Restores one of your monsters to full health.',
    cost: 2,
    targets: [{
      kind: 'ownMonster',
      prompt: 'Pick a wounded monster of yours',
      accepts: monster => monster.hp < monster.maxHp
    }],
    cast: heal
  },
  evolve: {
    name: 'Evolve',
    description: 'Raises one of your monsters to the next level at full health.',
    cost: 6,
    targets: [{ kind: 'ownMonster', prompt: 'Pick one of your monsters to evolve' }],
    cast: evolve
  }
}

/** Buys the spell in a slot and casts it on the chosen targets. Casting does not use up a turn. */
export function castSpell(state: GameState, slot: number, targets: Target[]): SpellResult {
  const spellId = state.spellSlots[slot]
  const spell = spellId ? SPELLS[spellId] : null
  if (
    !spell
    || state.gameOver
    || state.gold < spell.cost
    || !isValidSelection(state, spell.targets, targets)
  ) {
    return { state, valid: false }
  }

  const next = spell.cast({
    ...state,
    gold: state.gold - spell.cost,
    spellSlots: state.spellSlots.with(slot, null)
  }, ...targets)
  const reachedUnlockTier = next.cells.some(monster =>
    monster?.faction === 'player' && monster.tier >= ENEMY_TIER_UNLOCK_PLAYER_TIER
  )

  return {
    state: {
      ...next,
      enemyTierUnlockTurn: next.enemyTierUnlockTurn ?? (reachedUnlockTier ? next.turn : null)
    },
    valid: true
  }
}

export function getSpellSprite(spellId: SpellId): string {
  const file = spellId.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

  return `/sprites/spells/${file}.png`
}

function monsterAt(state: GameState, target: Target): Monster {
  const monster = state.cells[target.index]
  if (!monster) {
    throw new Error(`No monster at cell ${target.index}`)
  }

  return monster
}

function withCells(state: GameState, ...changes: [index: number, monster: Monster | null][]): GameState {
  const cells = [...state.cells]
  for (const [index, monster] of changes) {
    cells[index] = monster
  }

  return { ...state, cells }
}

function damageEnemies(state: GameState, indices: number[], damage: number): GameState {
  let next = state

  for (const index of indices) {
    const monster = state.cells[index]
    if (monster?.faction !== 'enemy') continue

    next = monster.hp > damage
      ? withCells(next, [index, { ...monster, hp: monster.hp - damage }])
      : rewardDefeat(withCells(next, [index, null]), monster)
  }

  return next
}

function rewardDefeat(state: GameState, enemy: Monster): GameState {
  return {
    ...state,
    score: state.score + getEnemyDefeatScore(enemy.tier),
    gold: state.gold + ENEMY_DEFEAT_REWARD.gold,
    xp: state.xp + ENEMY_DEFEAT_REWARD.xp
  }
}

function raiseTier(monster: Monster): Monster {
  const tier = monster.tier + 1
  const { maxHp, atk } = getMonsterStats(monster.typeId, tier)

  return { ...monster, tier, maxHp, atk, hp: maxHp }
}

function getNextPlayerType(typeId: string): string {
  const typeIds = getMonsterTypeIds('player')
  const next = typeIds[(typeIds.indexOf(typeId) + 1) % typeIds.length]
  if (!next) {
    throw new Error('Cannot change type without configured player monster types')
  }

  return next
}
