import { getEnemyDefeatScore } from './config'
import { isObstacle, OBSTACLE_HIT_DAMAGE } from './obstacles'
import type { Direction, GameEvent, GameState, Monster } from './types'

interface Attack {
  attackerIndex: number
  targetIndex: number
  damage: number
  type: 'attack' | 'counter'
}

interface CombatResult {
  cells: GameState['cells']
  cellsAfterActiveAttacks: GameState['cells']
  events: GameEvent[]
  hpChanged: boolean
  enemyDefeats: number
  enemyDefeatScore: number
}

function getAdjacentIndex(
  index: number,
  direction: Direction,
  width: number,
  height: number
): number | null {
  const x = index % width
  const y = Math.floor(index / width)

  if (direction === 'left') return x > 0 ? index - 1 : null
  if (direction === 'right') return x < width - 1 ? index + 1 : null
  if (direction === 'up') return y > 0 ? index - width : null
  return y < height - 1 ? index + width : null
}

function createAttacks(
  cells: GameState['cells'],
  direction: Direction,
  width: number,
  height: number,
  type: Attack['type']
): Attack[] {
  const attacks: Attack[] = []

  for (let attackerIndex = 0; attackerIndex < cells.length; attackerIndex++) {
    const attacker = cells[attackerIndex]
    if (!attacker || attacker.hp <= 0 || isObstacle(attacker)) continue

    const targetIndex = getAdjacentIndex(attackerIndex, direction, width, height)
    if (targetIndex === null) continue

    const target = cells[targetIndex]
    if (!target || target.hp <= 0 || target.faction === attacker.faction) continue

    attacks.push({
      attackerIndex,
      targetIndex,
      damage: isObstacle(target) ? OBSTACLE_HIT_DAMAGE : attacker.atk,
      type
    })
  }

  return attacks
}

function applyAttacks(
  cells: GameState['cells'],
  attacks: Attack[],
  events: GameEvent[]
): { cells: GameState['cells'], hpChanged: boolean, deaths: Monster[] } {
  const damageByIndex = new Map<number, number>()

  for (const attack of attacks) {
    const attacker = cells[attack.attackerIndex]
    const target = cells[attack.targetIndex]
    if (!attacker || !target) continue

    events.push({
      type: attack.type,
      attackerId: attacker.id,
      targetId: target.id,
      damage: attack.damage
    })
    damageByIndex.set(
      attack.targetIndex,
      (damageByIndex.get(attack.targetIndex) ?? 0) + attack.damage
    )
  }

  const nextCells = [...cells]
  const deaths: Monster[] = []
  let hpChanged = false

  for (const [index, damage] of damageByIndex) {
    const target = cells[index]
    if (!target) continue

    const hp = target.hp - damage
    if (hp !== target.hp) hpChanged = true
    if (hp <= 0) {
      deaths.push(target)
      nextCells[index] = null
      events.push({ type: 'death', monsterId: target.id, at: index })
    } else {
      nextCells[index] = { ...target, hp }
    }
  }

  return { cells: nextCells, hpChanged, deaths }
}

export function resolveCombat(state: GameState, direction: Direction): CombatResult {
  const events: GameEvent[] = []
  const activeAttacks = createAttacks(
    state.cells,
    direction,
    state.width,
    state.height,
    'attack'
  )
  const hitsObstacle = ({ targetIndex }: Attack) => {
    const target = state.cells[targetIndex]

    return !!target && isObstacle(target)
  }
  const activeAttackers = new Set(
    activeAttacks.filter(attack => !hitsObstacle(attack)).map(attack => attack.attackerIndex)
  )
  const activeAttackByTarget = new Map(
    activeAttacks.map(attack => [attack.targetIndex, attack])
  )

  const activeResult = applyAttacks(state.cells, activeAttacks, events)
  const counterAttacks: Attack[] = []

  for (const [targetIndex, activeAttack] of activeAttackByTarget) {
    const defender = activeResult.cells[targetIndex]
    if (!defender || isObstacle(defender) || activeAttack.damage <= 0 || activeAttackers.has(targetIndex)) continue

    const counterAttacker = activeResult.cells[activeAttack.attackerIndex]
    if (!counterAttacker) continue

    counterAttacks.push({
      attackerIndex: targetIndex,
      targetIndex: activeAttack.attackerIndex,
      damage: defender.atk,
      type: 'counter'
    })
  }

  const counterResult = applyAttacks(activeResult.cells, counterAttacks, events)
  const defeatedEnemies = [...activeResult.deaths, ...counterResult.deaths]
    .filter(monster => monster.faction === 'enemy')
  const enemyDefeatScore = defeatedEnemies.reduce(
    (score, monster) => score + getEnemyDefeatScore(monster.tier, state.config),
    0
  )

  return {
    cells: counterResult.cells,
    cellsAfterActiveAttacks: activeResult.cells,
    events,
    hpChanged: activeResult.hpChanged || counterResult.hpChanged,
    enemyDefeats: defeatedEnemies.length,
    enemyDefeatScore
  }
}
