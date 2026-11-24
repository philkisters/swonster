# Monster Merge — Project Context

> Living specification for a schematic, playable 2048-inspired monster-combat prototype. Read this file before implementing features. Implement confirmed rules faithfully; flag unresolved decisions instead of inventing mechanics.

## Goal

Build a browser-based, turn-based casual puzzle game that combines 2048 sliding/merging with directional monster combat. The purpose of the first prototype is to test whether movement, merging, attacking, counterattacking and anticipating spawns create fun tactical decisions. Prioritize correctness and fast iteration over visuals.

## Stack

- Nuxt 4, Vue 3 Composition API, TypeScript, Tailwind CSS.
- No dedicated game engine, backend, accounts or multiplayer for the MVP.
- Vitest for deterministic game-rule tests.
- Pure TypeScript rules, independent of Vue/DOM. Vue only renders state and dispatches inputs.
- Keyboard arrows/WASD and pointer-based swipe input on the board.

## Confirmed game rules

### Board and entities

- Start with a **5×5** board (prototype choice; configurable).
- Each cell is empty or contains exactly one monster.
- A cell can also hold an **obstacle** (currently only the rock). Obstacles are stored like monsters with the `neutral` faction: they occupy their cell for sliding, spawning and the full-board check, but belong to neither side, never attack or counter, and cannot be targeted or damaged by spells.
- Two factions: **player** (friendly) and **enemy**.
- Every monster has **current HP, maximum HP and attack (ATK)**. Also store unique ID, faction, monster type, merge tier, position, and movement behavior. HP and ATK are the two combat stats; other fields are identity/behavior metadata.
- Different monster types will exist to create more complex puzzles. Movement behavior can depend on monster type: some monsters slide with swipes; others remain stationary.
- Bosses are a distinct enemy spawn category. Boss-specific mechanics are not yet defined.

### Sliding and blocking

- Each swipe selects one of four cardinal directions: up/down/left/right.
- All movable monsters, friendly **and** enemy, slide in the chosen direction following 2048-style ordering and stop at blockers.
- Monsters of opposing factions **block** each other. No passing through, swapping positions or moving into occupied opposing cells.
- Stationary monsters are blockers, but can participate in combat.
- Compatible monsters of the same faction may merge during sliding. A newly merged monster may not merge again in that same swipe.
- Merging **fully restores HP** of the resulting monster to its new maximum HP, before combat.
- Different monster types exist; for the MVP, merge compatibility should require **same faction, same type, same tier**. This is a proposed safe default to confirm during balancing, not a universally fixed design rule.
- Tier progression, HP/ATK growth and exact type definitions must be configurable; illustrative 2+2→4 and doubling stats are **not final balancing decisions**.

### Directional combat

- After movement and merges, every living monster checks the **immediately adjacent cell in the swipe direction**.
- If that cell contains an opposing monster, it performs one active attack dealing its ATK as damage.
- **Movement is not required for attacking.** A blocked or stationary monster can attack if it has an enemy directly in the swipe direction.
- Resolve **all active attacks simultaneously** from a snapshot of the post-merge board, then apply damage and remove monsters with HP ≤ 0.
- **Only survivors** may counterattack, and counterattacks happen **after** active attack damage and deaths.
- A surviving monster that **received damage** during active attacks and **did not itself make an active attack** counters the monster that attacked it, dealing its ATK as damage.
- Each monster performs at most one active attack or one counterattack per turn. Resolve eligible counterattacks simultaneously, then remove any deaths.
- With one swipe direction and immediate-neighbor attacks, each monster can receive at most one active attack in that turn (from the single adjacent cell opposite the swipe direction). A monster may simultaneously attack the monster ahead and be attacked by the monster behind.
- No diagonal attacks, no attack through another monster.
- Reward defeated enemy monsters with score/gold/XP, exact amounts TBD. Do not award rewards for enemies that survive.

### Valid and invalid turns

- A swipe is **valid only if it changes the board state** by at least one actual monster movement, merge, or HP change caused by combat.
- A valid swipe advances the turn and consumes **exactly one** spawn-timeline entry if a free cell is available; otherwise the run ends without consuming it.
- An entirely inactive swipe does nothing: **no turn increment, no spawn, no timeline advance**.
- An attack without movement is still a valid turn if it actually changes HP.
- Prefer determining validity from actual movement/merge/damage events, rather than merely comparing final positions.

### Spawn timeline

- Show the **next 5–10 spawns** (prefer 10 in the first UI) in a horizontal timeline.
- **Green dot** = friendly monster; **red dot** = enemy monster; **red dot with crown** = boss monster.
- One timeline item is consumed after each valid turn if a free cell is available, and that monster spawns there.
- For the MVP, pre-generate a deterministic sequence per run so players can plan; seedable randomness is recommended for reproducible tests/replays.
- Exact spawn location policy (random free cell vs predictable/previewed position), spawn tiers/types, distribution, and boss frequency are **open decisions**. Use a simple configurable placeholder and document it.

### Game over

- Game over when a valid turn reaches the spawn step and **no free cell is available**, or when **no friendly monsters remain after spawning**.
- A spawn that fills the board does not immediately end the game. A later turn may make room through movement, merging, or combat before the next spawn attempt.
- Losing all friendly monsters before spawning does not immediately end the game; a queued friendly can still spawn and save the run.
- Inactive swipes do not attempt a spawn and therefore do not trigger game over, even on a full board.

### Spells

- Below the board are **4 spell slots**. A run starts with one spell; every valid turn deals one random spell (not already on offer) into the first empty slot. With all slots full no new spell arrives until one is bought.
- A spell is **bought with gold and cast immediately** on the targets the player picks. Casting is a free action: no turn increment, no spawn, no slot refill.
- A spell can only be bought with enough gold and when a complete set of valid targets exists. Cancelling before the last target costs nothing.
- Each spell is one function in `game/spells.ts`, registered in `SPELLS` with name, description, cost and its target steps. `game/targeting.ts` turns target steps into the options the UI highlights (cells, or rows/columns for line spells).
- Starter spells: Fireball (damage one enemy), Fireball Barrage (lower damage to every enemy in a row or column), Move / Super Move (own / any monster to a free cell), Swap / Super Swap (two own / any two monsters), Type Change (own monster becomes the next player type, HP ratio kept), Fusion (two own monsters of the same tier, any types, become one of the next tier with the first pick's type), Convert Enemy (enemy joins the player, keeps its type), Heal (own monster to full HP), Evolve (own monster +1 tier at full HP).
- Rock (1 gold) places a rock on a free cell. It never slides and blocks both factions. Every swipe that pushes a monster of either faction against it (the monster's next cell in swipe direction is the rock, whether or not it moved) adds one crack regardless of ATK; the fifth crack breaks it. A crack counts as a board change, so the swipe is a valid turn. Hitting a rock is not an attack: the monster can still counter in the same turn, and breaking a rock gives no reward.
- Freeze (5 gold) freezes any monster, friend or foe, for 3 valid turns (placeholder). A frozen monster does not slide and does not merge, so it blocks like a stationary monster, but it still attacks and counters. The freeze counts down at the end of each valid turn; an already frozen monster cannot be frozen again.
- Enemies defeated by spells grant the normal defeat rewards; Fusion grants the friendly merge score. Reaching the enemy-tier unlock level through a spell unlocks higher enemy tiers like a merge does.
- Costs and damage values are placeholders for balancing.

## Canonical turn pipeline

1. Receive direction from keyboard or swipe.
2. Calculate sliding movement for all movable monsters, respecting blockers and directional processing order.
3. Resolve compatible merges; create next-tier monsters with full HP. Each monster can participate in at most one merge this turn.
4. Determine all active attacks from the post-movement board.
5. Apply active-attack damage **simultaneously**.
6. Remove dead monsters (do not allow dead defenders to counter).
7. Determine counterattacks from surviving damaged defenders who did not actively attack.
8. Apply counterattack damage simultaneously; remove dead monsters.
9. Grant rewards for defeated enemy monsters.
10. If no movement, merge or HP change occurred, return **invalid** and preserve the original state (no spawn).
11. Deal a spell into the first empty spell slot, if any.
12. Attempt to spawn the next monster. If no free cell remains, end the game without advancing the spawn timeline.
13. Otherwise, advance the spawn timeline by one item and spawn the indicated monster in a free cell.
14. If no friendly monsters remain after spawning, end the game; return the new state and events.

**Implementation detail:** Determine whether a swipe is inactive before committing any effects. The ordering above lists validity at step 10 for clarity; pure engine code may compute a candidate state and discard it if invalid. Never mutate the input state.

## Suggested data model

```ts
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Faction = 'player' | 'enemy'
export type SpawnKind = 'friend' | 'enemy' | 'boss'

export interface Monster {
  id: string
  faction: Faction
  typeId: string
  tier: number
  hp: number
  maxHp: number
  atk: number
  movable: boolean
  isBoss?: boolean
}

export interface SpawnEntry {
  kind: SpawnKind
  typeId: string
  tier: number
}

export interface GameState {
  width: number
  height: number
  cells: (Monster | null)[] // row-major: index = y * width + x
  turn: number
  score: number
  gold: number
  xp: number
  spawnQueue: SpawnEntry[]
  gameOver: boolean
  rngSeed: number // optional seed-based random selection
}

export type GameEvent =
  | { type: 'move'; monsterId: string; from: number; to: number }
  | { type: 'merge'; sourceIds: [string, string]; resultId: string; at: number }
  | { type: 'attack'; attackerId: string; targetId: string; damage: number }
  | { type: 'counter'; attackerId: string; targetId: string; damage: number }
  | { type: 'death'; monsterId: string; at: number }
  | { type: 'spawn'; monsterId: string; at: number; kind: SpawnKind }
  | { type: 'gameOver'; reason: 'board-full' | 'no-friendly-monsters' }

export interface TurnResult {
  state: GameState
  events: GameEvent[]
  valid: boolean
}

export function executeTurn(state: GameState, direction: Direction): TurnResult
```

Event ordering should reflect the turn phases. Preserve stable IDs for animation and debugging. Keep a clear convention for merge result IDs and reward attribution.

## Architecture / suggested files

```text
app/
  pages/index.vue
  components/game/
    GameBoard.vue
    GameCell.vue
    MonsterTile.vue
    SpawnTimeline.vue
    GameHUD.vue
    DebugPanel.vue
  composables/
    useGame.ts
    useGameInput.ts

game/
  types.ts
  config.ts
  initialState.ts
  movement.ts
  merging.ts
  combat.ts
  spawning.ts
  engine.ts

tests/
  movement.test.ts
  merging.test.ts
  combat.test.ts
  engine.test.ts
```

- `executeTurn(state, direction)` is a **pure function** returning `{ state, events, valid }`.
- Keep all movement/merge/combat logic out of Vue components.
- `useGame` owns the reactive state and calls `executeTurn`.
- `useGameInput` handles arrows/WASD and pointer swipe, with minimum swipe distance, input lock during animations, and no keyboard capture while typing in inputs.
- Render the board with CSS Grid; Tailwind for styling. No engine, canvas or elaborate assets required.
- Use colors, tier labels and simple HP bars. Clearly distinguish faction and boss; do not rely on color alone.
- Event log and debug controls are more important than animation polish.

## Input rules

- Keyboard: arrow keys and optionally WASD.
- Touch/mouse: Pointer Events on board (`pointerdown`, `pointerup`, `pointercancel`), with `touch-action: none` on the board only.
- Determine swipe direction from the dominant movement axis after a threshold (~30px).
- Ignore key auto-repeat and inputs while a turn animation is in progress.
- A fully inactive swipe must not update the state or timeline.

## MVP implementation order

1. Render 5×5 board with hardcoded friendly/enemy monsters; keyboard + pointer swipe.
2. Pure movement and merging logic with tests.
3. HP, ATK, directional attacks, survivor-only counters, death and rewards.
4. Deterministic 10-item spawn preview and one spawn per valid turn.
5. Game-over conditions and restart.
6. Debug panel: place/remove monsters, change HP/ATK/type/tier/mobility, edit spawn queue, reset seed, replay input history.
7. Playtest and tune HP/ATK progression, spawn cadence, boss mechanics, and difficulty.

## Essential test cases

- Slide both factions in all four directions; neither crosses an opposing monster.
- Stationary monsters block sliding but can attack.
- Same-faction, same-type, same-tier merge restores full HP.
- A merge result does not merge again in the same swipe.
- A monster blocked by an enemy still attacks that enemy in swipe direction.
- An active attack kills its target: dead target **does not counter**.
- A defender surviving active damage counters if it made no active attack.
- A monster attacking forward while being hit from behind does **not** also counter.
- All active attacks are evaluated simultaneously, including attacks by monsters killed in that active-attack phase.
- A monster receives at most one direct active attack from the swipe direction.
- No-op swipe: no state mutation, turn advance or spawn.
- Attack-only swipe with HP damage: valid turn and one spawn.
- Spawn preview shifts by one after valid turn, not after invalid turn.
- Game over when a valid turn attempts to spawn on a full board or no friendlies remain after spawning. Filling the last cell alone does not end the game, and a friendly spawn can replace the last defeated friendly.
- Deterministic replay of same initial state, seed and input sequence produces same result.

## Open design questions (do not silently decide)

- Exact monster roster, special abilities, and whether some types have alternative merge compatibility.
- Tier/HP/ATK curves and boss HP/ATK scaling.
- Spawn position selection, enemy/friendly frequency and boss cadence.
- Whether to count a valid move that only changes positions but leads to no attack/merge as a turn: **yes**, per current rules.
- Reward formula and whether enemy merges increase future rewards.
- Tie-breaking / merge ordering for unusual type-specific mechanics.

## Copilot implementation guidance

- Implement one phase at a time, with Vitest tests before UI polish.
- Keep the engine deterministic and side-effect-free; never call `Math.random()` inside core rules without controlled seeded randomness.
- Never change confirmed rules to simplify implementation; ask when an edge case is ambiguous.
- Prefer readable, small functions and explicit phase-based events over clever compact algorithms.
- For initial playtesting, include a seed, restart button, move history and editable debug board.
- Keep rules configurable so balance can change without rewriting the engine.
