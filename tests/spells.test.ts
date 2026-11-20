import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_CONFIG, getMonsterStats, SPELL_REFILL_INTERVAL, SPELL_SLOT_COUNT } from '../game/config'
import { executeTurn } from '../game/engine'
import { createInitialState } from '../game/initialState'
import { createSpawnQueue } from '../game/spawning'
import { createSpellSlots, refillSpellSlot } from '../game/spellSlots'
import { castSpell, FIREBALL_BARRAGE_DAMAGE, FIREBALL_DAMAGE, SPELLS } from '../game/spells'
import type { Target } from '../game/targeting'
import type { Faction, GameState, Monster, SpellId } from '../game/types'

function createMonster(id: string, faction: Faction, overrides: Partial<Monster> = {}): Monster {
  const typeId = overrides.typeId ?? (faction === 'player' ? 'dragon' : 'skeletDragon')
  const stats = getMonsterStats(typeId, overrides.tier ?? 1)

  return { id, faction, typeId, tier: 1, hp: stats.maxHp, maxHp: stats.maxHp, atk: stats.atk, movable: true, ...overrides }
}

const STARTING_GOLD = Math.max(...Object.values(SPELLS).map(spell => spell.cost))

function createState(spellId: SpellId, monsters: [number, Monster][], gold = STARTING_GOLD): GameState {
  const cells: GameState['cells'] = Array(9).fill(null)
  for (const [index, monster] of monsters) {
    cells[index] = monster
  }

  return {
    width: 3,
    height: 3,
    cells,
    turn: 4,
    score: 0,
    gold,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...createSpawnQueue(42),
    ...createSpellSlots(42),
    spellSlots: [spellId, null, null, null]
  }
}

const cell = (index: number): Target => ({ shape: 'cell', index })

describe('buying spells', () => {
  it('pays the cost, empties the slot and does not use up a turn', () => {
    const state = createState('heal', [[0, createMonster('ally', 'player', { hp: 1 })]])

    const result = castSpell(state, 0, [cell(0)])

    expect(result.valid).toBe(true)
    expect(result.state.gold).toBe(STARTING_GOLD - SPELLS.heal.cost)
    expect(result.state.spellSlots).toEqual([null, null, null, null])
    expect(result.state.turn).toBe(4)
    expect(result.state.spawnQueue).toBe(state.spawnQueue)
    expect(state.cells[0]?.hp).toBe(1)
  })

  it('rejects a cast without enough gold, without a spell or with invalid targets', () => {
    const monsters: [number, Monster][] = [[0, createMonster('ally', 'player')], [1, createMonster('enemy', 'enemy')]]
    const broke = createState('fireball', monsters, SPELLS.fireball.cost - 1)
    const state = createState('fireball', monsters)

    expect(castSpell(broke, 0, [cell(1)])).toEqual({ state: broke, valid: false })
    expect(castSpell(state, 1, [cell(1)]).valid).toBe(false)
    expect(castSpell(state, 0, [cell(2)]).valid).toBe(false)
    expect(castSpell(state, 0, []).valid).toBe(false)
    expect(castSpell({ ...state, gameOver: true }, 0, [cell(1)]).valid).toBe(false)
  })
})

describe('spell effects', () => {
  it('uses the run configuration when a spell defeats an enemy', () => {
    const state = createState('fireball', [[1, createMonster('weak', 'enemy', { hp: 1 })]])
    state.config = { ...DEFAULT_GAME_CONFIG, enemyDefeatReward: { score: 25, gold: 7, xp: 9 } }

    const result = castSpell(state, 0, [cell(1)]).state
    expect(result).toMatchObject({ score: 25, gold: STARTING_GOLD - SPELLS.fireball.cost + 7, xp: 9 })
  })

  it('fireball damages one enemy and rewards a kill', () => {
    const tough = createMonster('tough', 'enemy', { tier: 2, hp: 12, maxHp: 12 })
    const weak = createMonster('weak', 'enemy', { hp: FIREBALL_DAMAGE })
    const state = createState('fireball', [[0, tough], [1, weak]])

    const wounded = castSpell(state, 0, [cell(0)]).state
    const killed = castSpell(state, 0, [cell(1)]).state

    expect(wounded.cells[0]?.hp).toBe(12 - FIREBALL_DAMAGE)
    expect(wounded.score).toBe(0)
    expect(killed.cells[1]).toBeNull()
    expect(killed.gold).toBe(STARTING_GOLD - SPELLS.fireball.cost + 1)
    expect(killed.score).toBeGreaterThan(0)
    expect(killed.xp).toBeGreaterThan(0)
  })

  it('fireball damages and defeats own monsters without a reward', () => {
    const tough = createMonster('tough', 'player')
    const weak = createMonster('weak', 'player', { hp: FIREBALL_DAMAGE })
    const state = createState('fireball', [[0, tough], [1, weak]])

    const wounded = castSpell(state, 0, [cell(0)]).state
    const killed = castSpell(state, 0, [cell(1)]).state

    expect(wounded.cells[0]?.hp).toBe(tough.hp - FIREBALL_DAMAGE)
    expect(killed.cells[1]).toBeNull()
    expect(killed.cells[0]).toBe(tough)
    expect(killed.gold).toBe(STARTING_GOLD - SPELLS.fireball.cost)
    expect(killed.score).toBe(0)
    expect(killed.xp).toBe(0)
  })

  it('fireball barrage damages every monster in the line, friend or foe', () => {
    const ally = createMonster('ally', 'player')
    const bystander = createMonster('enemy-3', 'enemy')
    const state = createState('fireballBarrage', [
      [3, createMonster('enemy-1', 'enemy')],
      [4, ally],
      [5, createMonster('enemy-2', 'enemy', { hp: 1 })],
      [8, bystander]
    ])

    const result = castSpell(state, 0, [{ shape: 'row', index: 1 }]).state

    expect(result.cells[3]?.hp).toBe(6 - FIREBALL_BARRAGE_DAMAGE)
    expect(result.cells[4]?.hp).toBe(ally.hp - FIREBALL_BARRAGE_DAMAGE)
    expect(result.cells[5]).toBeNull()
    expect(result.cells[8]).toBe(bystander)
    expect(castSpell(state, 0, [{ shape: 'row', index: 0 }]).valid).toBe(false)
  })

  it('fireball barrage rewards only the enemies it defeats', () => {
    const state = createState('fireballBarrage', [
      [3, createMonster('ally', 'player', { hp: FIREBALL_BARRAGE_DAMAGE })],
      [4, createMonster('enemy', 'enemy', { hp: FIREBALL_BARRAGE_DAMAGE })],
      [5, createMonster('ally-2', 'player', { hp: 1 })]
    ])
    const enemyOnly = createState('fireballBarrage', [[4, createMonster('enemy', 'enemy', { hp: FIREBALL_BARRAGE_DAMAGE })]])

    const result = castSpell(state, 0, [{ shape: 'row', index: 1 }]).state
    const expected = castSpell(enemyOnly, 0, [{ shape: 'row', index: 1 }]).state

    expect(result.cells.every(monster => monster === null)).toBe(true)
    expect(result.gold).toBe(STARTING_GOLD - SPELLS.fireballBarrage.cost + 1)
    expect(result.score).toBe(expected.score)
    expect(result.xp).toBe(expected.xp)
  })

  it('move relocates only own monsters, super move any monster', () => {
    const monsters: [number, Monster][] = [[0, createMonster('ally', 'player')], [1, createMonster('enemy', 'enemy')]]
    const moveState = createState('move', monsters)
    const superState = createState('superMove', monsters)

    const moved = castSpell(moveState, 0, [cell(0), cell(8)]).state

    expect(moved.cells[0]).toBeNull()
    expect(moved.cells[8]?.id).toBe('ally')
    expect(castSpell(moveState, 0, [cell(1), cell(8)]).valid).toBe(false)
    expect(castSpell(moveState, 0, [cell(0), cell(1)]).valid).toBe(false)
    expect(castSpell(superState, 0, [cell(1), cell(8)]).state.cells[8]?.id).toBe('enemy')
  })

  it('swap exchanges two own monsters, super swap any two monsters', () => {
    const monsters: [number, Monster][] = [
      [0, createMonster('ally', 'player')],
      [1, createMonster('ally-2', 'player')],
      [2, createMonster('enemy', 'enemy')]
    ]
    const swapState = createState('swap', monsters)
    const superState = createState('superSwap', monsters)

    const swapped = castSpell(swapState, 0, [cell(0), cell(1)]).state
    const superSwapped = castSpell(superState, 0, [cell(0), cell(2)]).state

    expect(swapped.cells.slice(0, 2).map(monster => monster?.id)).toEqual(['ally-2', 'ally'])
    expect(castSpell(swapState, 0, [cell(0), cell(2)]).valid).toBe(false)
    expect(castSpell(swapState, 0, [cell(0), cell(0)]).valid).toBe(false)
    expect(superSwapped.cells[0]?.id).toBe('enemy')
    expect(superSwapped.cells[2]?.id).toBe('ally')
  })

  it('type change switches to the other player type and keeps the health ratio', () => {
    const state = createState('typeChange', [[0, createMonster('ally', 'player', { tier: 2, hp: 10, maxHp: 20, atk: 4 })]])

    const changed = castSpell(state, 0, [cell(0)]).state.cells[0]

    expect(changed).toMatchObject({ id: 'ally', typeId: 'griffin', tier: 2, ...getMonsterStats('griffin', 2) })
    expect(changed?.hp).toBe(getMonsterStats('griffin', 2).maxHp / 2)
  })

  it('fusion merges two own monsters of the same level, even of different types', () => {
    const state = createState('fusion', [
      [0, createMonster('dragon', 'player', { hp: 1 })],
      [1, createMonster('griffin', 'player', { typeId: 'griffin' })],
      [2, createMonster('big', 'player', { tier: 2 })]
    ])

    const result = castSpell(state, 0, [cell(1), cell(0)]).state

    expect(result.cells[0]).toBeNull()
    expect(result.cells[1]).toMatchObject({ typeId: 'griffin', tier: 2, hp: getMonsterStats('griffin', 2).maxHp })
    expect(result.score).toBeGreaterThan(0)
    expect(castSpell(state, 0, [cell(0), cell(2)]).valid).toBe(false)
    expect(castSpell(state, 0, [cell(2), cell(0)]).valid).toBe(false)
  })

  it('convert enemy turns an enemy into a friendly monster', () => {
    const state = createState('convertEnemy', [[0, createMonster('enemy', 'enemy', { hp: 3 })]])

    expect(castSpell(state, 0, [cell(0)]).state.cells[0]).toMatchObject({
      id: 'enemy',
      faction: 'player',
      typeId: 'skeletDragon',
      hp: 3
    })
  })

  it('heal restores a wounded own monster only', () => {
    const state = createState('heal', [
      [0, createMonster('wounded', 'player', { hp: 2 })],
      [1, createMonster('healthy', 'player')]
    ])

    expect(castSpell(state, 0, [cell(0)]).state.cells[0]?.hp).toBe(10)
    expect(castSpell(state, 0, [cell(1)]).valid).toBe(false)
  })

  it('evolve raises the level at full health and unlocks enemy tiers at level 3', () => {
    const state = createState('evolve', [[0, createMonster('ally', 'player', { tier: 2, hp: 1, maxHp: 20, atk: 4 })]])

    const result = castSpell(state, 0, [cell(0)]).state

    expect(result.cells[0]).toMatchObject({ id: 'ally', tier: 3, ...getMonsterStats('dragon', 3) })
    expect(result.cells[0]?.hp).toBe(getMonsterStats('dragon', 3).maxHp)
    expect(result.enemyTierUnlockTurn).toBe(4)
  })
})

describe('spell slots', () => {
  it('starts with one spell and deals one more every few valid turns', () => {
    const state = createInitialState(42)
    const offTurn = executeTurn(state, 'left')
    const refillTurn = executeTurn({ ...state, turn: SPELL_REFILL_INTERVAL - 1 }, 'left')

    expect(state.spellSlots).toHaveLength(SPELL_SLOT_COUNT)
    expect(state.spellSlots.filter(Boolean)).toHaveLength(1)
    expect(offTurn.valid).toBe(true)
    expect(offTurn.state.spellSlots).toEqual(state.spellSlots)
    expect(offTurn.state.spellRngSeed).toBe(state.spellRngSeed)
    expect(refillTurn.state.spellSlots.filter(Boolean)).toHaveLength(2)
    expect(refillTurn.state.spellSlots[0]).toBe(state.spellSlots[0])
  })

  it('deals distinct spells deterministically and stops once every slot is taken', () => {
    let slots = createSpellSlots(7)
    for (let turn = 0; turn < SPELL_SLOT_COUNT; turn++) {
      slots = refillSpellSlot(slots)
    }

    expect(new Set(slots.spellSlots).size).toBe(SPELL_SLOT_COUNT)
    expect(slots.spellSlots.every(spellId => spellId !== null && spellId in SPELLS)).toBe(true)
    expect(refillSpellSlot(slots)).toEqual(slots)
    expect(refillSpellSlot(refillSpellSlot(createSpellSlots(7)))).toEqual(refillSpellSlot(refillSpellSlot(createSpellSlots(7))))
  })

  it('refills the slot of a bought spell on the next refill', () => {
    const full = { ...createSpellSlots(7), spellSlots: ['heal', 'move', 'swap', 'evolve'] satisfies SpellId[] }
    const afterPurchase = { ...full, spellSlots: full.spellSlots.with(1, null) }

    const refilled = refillSpellSlot(afterPurchase).spellSlots

    expect(refilled[1]).not.toBeNull()
    expect(['heal', 'swap', 'evolve']).not.toContain(refilled[1])
    expect(refilled.with(1, null)).toEqual(afterPurchase.spellSlots)
  })
})
