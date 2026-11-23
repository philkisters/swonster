<template>
  <div class="game-shell">
    <GameHeader
      v-if="gameReady"
      :score="state.score"
      :gold="state.gold"
      :xp="state.xp"
      @end-game="returnToMenu"
    />
    <p v-if="trackingError" class="game-tracking-error" role="alert">{{ trackingError }}</p>
    <p v-if="configError" class="game-tracking-error" role="alert">{{ configError }}</p>
    <button v-if="configError" type="button" @click="router.push('/')">Go to Main Menu</button>
    <MenuLoading v-if="!gameReady && !configError && !archivedResume" text="Loading game configuration..." :size="8" />

    <section
      v-if="archivedResume"
      class="game-config-warning"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="archived-config-title"
    >
      <h2 id="archived-config-title">Out-of-date configuration</h2>
      <p>
        The resumed game uses an out-of-date configuration. You can continue playing, but the results will not be visible in the highscore list.
      </p>
      <div class="game-config-warning-actions">
        <button type="button" @click="returnToMenu">Return to menu</button>
        <button type="button" @click="continueArchivedGame">Continue anyway</button>
      </div>
    </section>

    <section
      v-if="gameReady"
      class="play-area"
      aria-label="Game"
    >
      <div class="game-board-column">
        <GameSpawnTimeline
          :history="spawnHistory"
          :queue="state.spawnQueue"
          :turn="state.turn"
          :config="state.config"
        />

        <div class="game-board-wrapper">
          <GameBoard
            :state="state"
            :attack-animations="attackAnimations"
            :merge-animations="mergeAnimations"
            :targeting="targeting"
            :spell-effect="spellEffect"
            :health-popups="healthPopups"
            @pick="pickTarget"
            @spell-effect-done="finishSpellEffect"
            @health-popup-done="finishHealthPopup"
            @merge-animations-done="finishMergeAnimations"
            @attack-animations-done="finishAttackAnimations"
            @spawn-animation-done="finishSpawnAnimation"
            @move="moveWhenReady"
          />
          <GameTutorial v-if="showTutorial" @close="showTutorial = false" />
          <section
            v-if="state.gameOver"
            class="game-over-overlay"
            role="status"
            aria-live="polite"
          >
            <h2>Game over</h2>
            <p>
              {{ state.gameOverReason === 'no-friendly-monsters'
                ? 'No friendly monsters remain.'
                : 'There is no room for the next monster.' }}
            </p>
            <div class="game-over-score">
              <span>Score</span>
              <strong>{{ state.score }}</strong>
            </div>
            <button
              type="button"
              class="game-over-restart"
              @click="restartGame"
            >
              New game
            </button>
            <button
              type="button"
              class="game-over-menu"
              @click="returnToMenu"
            >
              Go to Main Menu
            </button>
          </section>
        </div>
        <GameSpellBar
          :cards="spellCards"
          :targeting="targeting"
          :disabled="showTutorial || state.gameOver || !!trackingError"
          @select="selectSpell"
          @cancel="cancelSpell"
        />
        <section
          v-if="!state.gameOver && state.cells.every(monster => monster !== null)"
          class="game-over-card"
          role="status"
          aria-live="polite"
        >
          <div>
            <h2>Board full</h2>
            <p>
              Make room with your next move or a spell, or start a new game.
            </p>
          </div>
          <button
            type="button"
            class="game-over-restart"
            @click="restartGame"
          >
            New game
          </button>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Direction, GameState, SpawnEntry } from '../../game/types'
import type { AvailableConfig } from '../../game/configValidation'
import { ArchivedConfigError, MissingConfigError } from '~/composables/useGameTracking'

const showTutorial = ref(true)
const gameReady = ref(false)
const configError = ref('')
const archivedResume = ref(false)
let pendingResume: { state: GameState, history: SpawnEntry[] } | undefined
let selectedConfig: AvailableConfig | undefined
const {
  error: trackingError,
  connect,
  begin,
  record,
  end,
  loadConfig,
  loadActiveGame,
} = useGameTracking()

const {
  state,
  spawnHistory,
  attackAnimations,
  mergeAnimations,
  spellEffect,
  healthPopups,
  isAnimating,
  move,
  cast,
  restart,
  restore,
  finishMergeAnimations,
  finishAttackAnimations,
  finishSpawnAnimation,
  finishSpellEffect,
  finishHealthPopup
} = useGame(record)

const {
  cards: spellCards,
  targeting,
  select: selectSpell,
  pick: pickTarget,
  cancel: cancelSpell
} = useSpellCasting(state, isAnimating, cast)

watch(trackingError, (message) => {
  if (message) cancelSpell()
})

function moveWhenReady(direction: Direction) {
  if (gameReady.value && !trackingError.value && !showTutorial.value && !targeting.value) move(direction)
}

async function restartGame() {
  try {
    if (selectedConfig) selectedConfig = await loadConfig(selectedConfig.id)
    await end()
    cancelSpell()
    const seed = restart()
    if (selectedConfig) await begin(seed, selectedConfig, state.value, spawnHistory.value)
  } catch (cause) {
    console.error('Could not start a new game.', cause)
    if (!(cause instanceof ArchivedConfigError)) gameReady.value = false
    configError.value = cause instanceof ArchivedConfigError
      ? cause.message
      : 'Could not start a new game. Return to the menu and try again.'
  }
}

async function returnToMenu() {
  try {
    await end()
  } catch (cause) {
    console.error('Could not save the game before returning to the menu.', cause)
  }
  cancelSpell()
  await router.push('/')
}

function continueArchivedGame() {
  if (!pendingResume) return
  restore(pendingResume.state, pendingResume.history)
  pendingResume = undefined
  archivedResume.value = false
  showTutorial.value = false
  gameReady.value = true
}

onMounted(async () => {
  try {
    if (route.query.offline === '1') {
      restart()
      gameReady.value = true
      return
    }
    await connect()
    if (route.query.resume === '1') {
      const saved = await loadActiveGame()
      if (!saved) throw new Error('No active game is available.')
      selectedConfig = saved.config
      if (saved.usesArchivedConfig) {
        pendingResume = { state: saved.state, history: saved.history }
        archivedResume.value = true
        return
      }
      restore(saved.state, saved.history)
      showTutorial.value = false
      gameReady.value = true
      return
    }
    if (typeof route.query.config !== 'string' || !route.query.config) {
      throw new Error('No game configuration selected.')
    }
    selectedConfig = await loadConfig(route.query.config)
    const seed = restart(selectedConfig.rules)
    await begin(seed, selectedConfig, state.value, spawnHistory.value)
    gameReady.value = true
  } catch (cause) {
    console.error('Could not start the game.', cause)
    configError.value = cause instanceof ArchivedConfigError
      ? cause.message
      : cause instanceof MissingConfigError
        ? cause.message
        : 'Could not load the configuration or start the game. Return to the menu and try again.'
  }
})
const router = useRouter()
const route = useRoute()
useGameInput(moveWhenReady, cancelSpell)
</script>

<style>
.game-tracking-error {
  margin: 0;
  color: var(--game-damage-text);
}

.game-config-warning {
  display: grid;
  gap: 1rem;
  width: min(100% - 2rem, 32rem);
  margin: 10vh auto 0;
  padding: 1.5rem;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-bg-elevated);
}

.game-config-warning h2,
.game-config-warning p {
  margin: 0;
}

.game-config-warning-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.game-board-column {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}

.game-board-wrapper {
  position: relative;
}

.eyebrow {
  margin: 0 0 0.6rem;
  color: var(--game-accent-text);
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.16em;
}

.game-over-overlay {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 1.5rem;
  background: var(--ui-bg);
  inset: 0;
  text-align: center;
}

.game-over-overlay h2 {
  margin: 0;
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 850;
}

.game-over-overlay p {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
}

.game-over-score {
  display: flex;
  flex-direction: column;
  color: var(--game-accent-text);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.game-over-score strong {
  color: var(--ui-text-highlighted);
  font-size: clamp(2.5rem, 10vw, 4rem);
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.game-over-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
  box-shadow: 0 0.5rem 1.5rem rgb(40 50 32 / 5%);
}

.game-over-card h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.game-over-card p {
  margin: 0.25rem 0 0;
  color: var(--ui-text-muted);
  font-size: 0.85rem;
}

.game-over-restart {
  flex: 0 0 auto;
  padding: 0.65rem 0.9rem;
  border: 0;
  border-radius: 0.7rem;
  background: var(--game-accent-strong);
  color: var(--ui-text-inverted);
  font-weight: 750;
  cursor: pointer;
}

.game-over-restart:hover {
  filter: brightness(0.9);
}

.game-over-menu {
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.7rem;
  background: var(--ui-bg-elevated);
  color: var(--ui-text-highlighted);
  font-weight: 750;
  cursor: pointer;
}

.game-over-menu:hover {
  background: var(--ui-bg-muted);
}

.game-help {
  display: grid;
  gap: 0.75rem;
}

.control-card {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
}

.control-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--ui-bg-muted);
  color: var(--game-accent-text);
  font-size: 1.2rem;
  font-weight: 800;
}

.control-card h2 {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 800;
}

.control-card p {
  margin: 0.3rem 0 0;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.game-footer {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: 0.75rem 1.25rem;
  color: var(--ui-text-muted);
  font-size: 0.78rem;
  font-weight: 650;
}

.game-footer span {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.legend-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}

.legend-dot--player {
  background: var(--game-accent-strong);
}

.legend-dot--enemy {
  background: var(--game-enemy-strong);
}

.merge-note {
  grid-column: 1 / -1;
  font-weight: 500;
}

@media (max-width: 480px) {
  .game-tutorial-overlay,
  .game-over-overlay {
    border-radius: 1rem;
  }

  .game-help {
    gap: 0.5rem;
  }

  .control-card {
    gap: 0.55rem;
    padding: 0.7rem;
  }

  .game-footer {
    gap: 0.6rem 1rem;
  }
}
</style>
