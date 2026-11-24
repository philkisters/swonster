import { describe, expect, it } from 'vitest'
import { executeTurn } from '../game/engine'
import { FREEZE_TURNS } from '../game/freezing'
import { createSpawnQueue } from '../game/spawning'
import { createSpellSlots } from '../game/spellSlots'
import { castSpell, SPELLS } from '../game/spells'
import { persistedGameStateSchema } from '../game/stateValidation'
import type { Target } from '../game/targeting'
import type { Faction, GameState, Monster, SpellId } from '../game/types'

function createMonster(id: string, faction: Faction, overrides: Partial<Monster> = {}): Monster {
  return { id, faction, typeId: 'dragon', tier: 1, hp: 8, maxHp: 8, atk: 2, movable: true, ...overrides }
}

function createState(width: number, height: number, monsters: [number, Monster][], spellId: SpellId | null = null): GameState {
  const cells: GameState['cells'] = Array(width * height).fill(null)
  for (const [index, monster] of monsters) {
    cells[index] = monster
  }

  return {
    width,
    height,
    cells,
    turn: 0,
    score: 0,
    gold: 100,
    xp: 0,
    enemyTierUnlockTurn: null,
    gameOver: false,
    ...createSpawnQueue(42),
    ...createSpellSlots(42),
    spellSlots: [spellId, null, null, null]
  }
}

const cell = (index: number): Target => ({ shape: 'cell', index })
const frozen = (id: string, faction: Faction, overrides: Partial<Monster> = {}) =>
  createMonster(id, faction, { frozenTurns: FREEZE_TURNS, ...overrides })

describe('freeze spell', () => {
  it('costs 5 gold and freezes any monster, friend or foe', () => {
    const state = createState(3, 1, [[0, createMonster('ally', 'player')], [2, createMonster('enemy', 'enemy')]], 'freeze')

    const enemy = castSpell(state, 0, [cell(2)])
    const ally = castSpell(state, 0, [cell(0)])

    expect(SPELLS.freeze.cost).toBe(5)
    expect(enemy.state.gold).toBe(95)
    expect(enemy.state.cells[2]).toMatchObject({ id: 'enemy', frozenTurns: FREEZE_TURNS })
    expect(ally.state.cells[0]).toMatchObject({ id: 'ally', frozenTurns: FREEZE_TURNS })
    expect(state.cells[2]?.frozenTurns).toBeUndefined()
  })

  it('cannot target a monster that is already frozen', () => {
    const state = createState(3, 1, [[0, frozen('ally', 'player')]], 'freeze')

    expect(castSpell(state, 0, [cell(0)]).valid).toBe(false)
  })
})

describe('frozen monsters', () => {
  it('do not slide and block other monsters', () => {
    const state = createState(4, 1, [[0, createMonster('ally', 'player', { typeId: 'griffin' })], [1, frozen('ice', 'player')]])

    const result = executeTurn(state, 'right')

    expect(result.valid).toBe(false)
    expect(executeTurn(state, 'left').valid).toBe(false)
  })

  it('do not merge with a matching monster sliding into them', () => {
    const state = createState(3, 1, [[0, createMonster('ally', 'player')], [2, frozen('ice', 'player')]])

    const result = executeTurn(state, 'right')

    expect(result.events.some(event => event.type === 'merge')).toBe(false)
    expect(result.stateBeforeSpawn?.cells.map(monster => monster?.id ?? null)).toEqual([null, 'ally', 'ice'])
  })

  it('still attack and counter', () => {
    const attacking = createState(3, 1, [[0, frozen('ice', 'player')], [1, createMonster('enemy', 'enemy', { movable: false })]])
    const countering = createState(3, 1, [[0, createMonster('enemy', 'enemy', { movable: false })], [1, frozen('ice', 'player')]])

    expect(executeTurn(attacking, 'right').events).toContainEqual({ type: 'attack', attackerId: 'ice', targetId: 'enemy', damage: 2 })
    expect(executeTurn(countering, 'right').events).toContainEqual({ type: 'counter', attackerId: 'ice', targetId: 'enemy', damage: 2 })
  })

  it(`thaw after ${FREEZE_TURNS} valid turns and slide again`, () => {
    let state = createState(1, 8, [[0, frozen('ice', 'enemy')], [1, createMonster('ally', 'player')]])
    state.spawnQueue = state.spawnQueue.map(() => ({ kind: 'friend', typeId: 'griffin', tier: 1 }))
    const turnsLeft: (number | undefined)[] = []

    for (let turn = 0; turn < FREEZE_TURNS; turn++) {
      const next = executeTurn(state, turn % 2 === 0 ? 'down' : 'up').state
      const ice = next.cells.find(monster => monster?.id === 'ice')
      turnsLeft.push(ice?.frozenTurns)
      state = { ...next, cells: [ice ?? null, createMonster('ally', 'player'), ...Array(6).fill(null)] }
    }

    expect(turnsLeft).toEqual([2, 1, undefined])
    expect(state.cells[0] && 'frozenTurns' in state.cells[0]).toBe(false)
    expect(executeTurn({ ...state, cells: state.cells.with(1, null) }, 'down').state.cells[7]?.id).toBe('ice')
  })

  it('stay frozen through an inactive swipe', () => {
    const state = createState(2, 1, [[0, frozen('ice', 'player')]])

    const result = executeTurn(state, 'left')

    expect(result.valid).toBe(false)
    expect(result.state.cells[0]?.frozenTurns).toBe(FREEZE_TURNS)
  })

  it('survive saving and restoring a game', () => {
    const state = createState(2, 1, [[0, frozen('ice', 'player')]])

    expect(persistedGameStateSchema.parse(state).cells[0]?.frozenTurns).toBe(FREEZE_TURNS)
  })
})
