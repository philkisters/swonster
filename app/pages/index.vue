<script setup lang="ts">
import { computed, ref } from 'vue'
import GameBoard from '../components/game/GameBoard.vue'
import SpawnTimeline from '../components/game/SpawnTimeline.vue'
import { useGame } from '../composables/useGame'
import { useGameInput } from '../composables/useGameInput'
import type { Direction } from '../../game/types'

const tutorialSteps = [
  {
    icon: '↑ ↓ ← →',
    title: 'How to move',
    description: 'Use the arrow keys or WASD, or swipe on the board. All movable monsters slide in the chosen direction.'
  },
  {
    icon: '⚔',
    title: 'Attack',
    description: 'Move towards an enemy to attack. Monsters attack opposing monsters next to them in the direction of movement.'
  },
  {
    icon: '↩',
    title: 'Counterattack',
    description: 'A monster that survives an attack strikes back if it did not already attack that turn.'
  },
  {
    icon: '● ● ●',
    title: 'Upcoming spawns',
    description: 'The timeline shows the next monsters to spawn. After each valid move, the first appears if there is room on the board.'
  }
]
const tutorialStep = ref(0)
const showTutorial = ref(true)
const { app } = useRuntimeConfig()
const currentTutorialStep = computed(() => {
  const step = tutorialSteps[tutorialStep.value]
  if (!step) throw new Error('Invalid tutorial step')
  return step
})
const {
  state,
  attackAnimations,
  mergeAnimations,
  move,
  restart,
  finishMergeAnimations,
  finishAttackAnimations,
  finishSpawnAnimation
} = useGame()

function moveWhenReady(direction: Direction) {
  if (!showTutorial.value) move(direction)
}

function advanceTutorial() {
  if (tutorialStep.value < tutorialSteps.length - 1) {
    tutorialStep.value++
  } else {
    showTutorial.value = false
  }
}

useGameInput(moveWhenReady)
</script>

<template>
  <main class="game-page">
    <div class="game-shell">
      <section
        class="play-area"
        aria-label="Game"
      >
        <div class="game-board-column">
          <SpawnTimeline :queue="state.spawnQueue" />

          <div class="game-board-wrapper">
            <GameBoard
              :state="state"
              :attack-animations="attackAnimations"
              :merge-animations="mergeAnimations"
              @merge-animations-done="finishMergeAnimations"
              @attack-animations-done="finishAttackAnimations"
              @spawn-animation-done="finishSpawnAnimation"
              @move="moveWhenReady"
            />
            <section
              v-if="showTutorial"
              class="game-tutorial-overlay"
              aria-labelledby="tutorial-title"
            >
              <div
                class="game-tutorial-content"
                aria-live="polite"
                aria-atomic="true"
              >
                <span class="game-tutorial-progress">Step {{ tutorialStep + 1 }} of {{ tutorialSteps.length }}</span>
                <span
                  class="game-tutorial-icon"
                  aria-hidden="true"
                >{{ currentTutorialStep.icon }}</span>
                <h2 id="tutorial-title">
                  {{ currentTutorialStep.title }}
                </h2>
                <p>{{ currentTutorialStep.description }}</p>
              </div>
              <div class="game-tutorial-actions">
                <button
                  v-if="tutorialStep > 0"
                  type="button"
                  class="game-tutorial-back"
                  @click="tutorialStep--"
                >
                  Back
                </button>
                <button
                  type="button"
                  class="game-over-restart"
                  @click="advanceTutorial"
                >
                  {{ tutorialStep < tutorialSteps.length - 1 ? 'Next' : 'I understand' }}
                </button>
              </div>
            </section>
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
                @click="restart"
              >
                New game
              </button>
            </section>
          </div>
          <section
            v-if="!state.gameOver && state.cells.every(monster => monster !== null)"
            class="game-over-card"
            role="status"
            aria-live="polite"
          >
            <div>
              <h2>Board full</h2>
              <p>
                Make room with your next move or start a new game.
              </p>
            </div>
            <button
              type="button"
              class="game-over-restart"
              @click="restart"
            >
              New game
            </button>
          </section>
        </div>

        <aside class="game-sidebar">
          <header class="game-header">
            <div class="game-brand">
              <img
                class="game-logo"
                :src="`${app.baseURL}logo.png`"
                alt=""
                width="80"
                height="80"
              >
              <h1>Swonster</h1>
            </div>
            <p class="game-description">
              Slide your monsters together and find your way across the board.
            </p>
          </header>

          <div
            class="game-counters"
            aria-label="Game stats"
            aria-live="polite"
          >
            <div class="turn-counter">
              <span class="turn-label">TURN</span>
              <span class="turn-number">{{ state.turn }}</span>
            </div>
            <div class="turn-counter">
              <span class="turn-label">SCORE</span>
              <span class="turn-number">{{ state.score }}</span>
            </div>
            <div class="turn-counter">
              <span class="turn-label">GOLD</span>
              <span class="turn-number">{{ state.gold }}</span>
            </div>
            <div class="turn-counter">
              <span class="turn-label">XP</span>
              <span class="turn-number">{{ state.xp }}</span>
            </div>
          </div>

          <section
            class="game-help"
            aria-label="How to play"
          >
            <div class="control-card">
              <span
                class="control-icon"
                aria-hidden="true"
              >↔</span>
              <div>
                <h2>Merge</h2>
                <p>Combine monsters of the same type and tier.</p>
              </div>
            </div>
          </section>

          <footer class="game-footer">
            <span><i class="legend-dot legend-dot--player" /> Allies</span>
            <span><i class="legend-dot legend-dot--enemy" /> Enemies</span>
          </footer>
        </aside>
      </section>
    </div>
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  background: var(--ui-bg);
  color: var(--ui-text);
  --game-accent-text: var(--ui-color-primary-700);
  --game-accent-strong: var(--ui-color-primary-700);
  --game-enemy-text: var(--ui-color-warning-700);
  --game-enemy-strong: var(--ui-color-warning-700);
  --game-player-bg: color-mix(in srgb, var(--ui-color-primary-500) 18%, var(--ui-bg));
  --game-enemy-bg: color-mix(in srgb, var(--ui-color-warning-500) 18%, var(--ui-bg));
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

.dark {
  color-scheme: dark;
  --game-accent-text: var(--ui-color-primary-300);
  --game-accent-strong: var(--ui-color-primary-400);
  --game-enemy-text: var(--ui-color-warning-300);
  --game-enemy-strong: var(--ui-color-warning-400);
  --game-player-bg: color-mix(in srgb, var(--ui-color-primary-500) 24%, var(--ui-bg));
  --game-enemy-bg: color-mix(in srgb, var(--ui-color-warning-500) 24%, var(--ui-bg));
}

.light {
  color-scheme: light;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--ui-color-primary-500) 12%, transparent), transparent 34rem),
    radial-gradient(circle at 90% 85%, color-mix(in srgb, var(--ui-color-warning-500) 10%, transparent), transparent 30rem),
    var(--ui-bg);
}

button,
input {
  font: inherit;
}

.game-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: clamp(1rem, 4vw, 3rem);
}

.game-shell {
  width: min(100%, 74rem);
}

.play-area {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 20rem);
  align-items: center;
  gap: clamp(1.5rem, 5vw, 4rem);
}

.game-board-column {
  display: grid;
  width: min(100%, 34rem);
  justify-self: center;
  gap: 0.75rem;
}

.game-board-wrapper {
  position: relative;
}

.game-sidebar {
  display: grid;
  gap: 1rem;
}

.game-header {
  margin-bottom: 0.25rem;
}

.game-brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.game-logo {
  width: clamp(4rem, 16vw, 5rem);
  height: clamp(4rem, 16vw, 5rem);
  flex: 0 0 auto;
  border: 2px solid color-mix(in srgb, var(--ui-color-warning-400) 65%, var(--ui-border));
  border-radius: 1.15rem;
  box-shadow:
    0 0.75rem 2rem color-mix(in srgb, var(--ui-color-primary-950) 18%, transparent),
    0 0 0 0.25rem color-mix(in srgb, var(--ui-color-warning-500) 8%, transparent);
  object-fit: cover;
}

.eyebrow {
  margin: 0 0 0.6rem;
  color: var(--game-accent-text);
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.16em;
}

h1 {
  margin: 0;
  color: var(--ui-color-primary-800);
  font-size: clamp(2.5rem, 7vw, 4rem);
  font-weight: 850;
  letter-spacing: -0.07em;
  line-height: 0.95;
}

.dark h1 {
  color: var(--ui-color-warning-300);
}

.game-description {
  margin: 0.9rem 0 0;
  color: var(--ui-text-muted);
  font-size: 1rem;
  line-height: 1.6;
}

.game-counters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.turn-counter {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.35rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
  box-shadow: 0 0.5rem 1.5rem rgb(40 50 32 / 5%);
}

.turn-label {
  color: var(--ui-text-muted);
  font-size: 0.65rem;
  font-weight: 850;
  letter-spacing: 0.08em;
}

.turn-number {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.25;
}

.game-tutorial-overlay {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 1rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 1.5rem;
  background: var(--ui-bg);
  inset: 0;
  text-align: center;
}

.game-tutorial-content {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
}

.game-tutorial-progress {
  color: var(--ui-text-muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.game-tutorial-icon {
  color: var(--game-accent-text);
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 800;
  letter-spacing: 0.1em;
}

.game-tutorial-overlay h2 {
  margin: 0;
  font-size: clamp(1.3rem, 4vw, 1.8rem);
  font-weight: 850;
}

.game-tutorial-overlay p {
  max-width: 22rem;
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.game-tutorial-actions {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.game-tutorial-back {
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.7rem;
  background: var(--ui-bg-elevated);
  color: var(--ui-text);
  font-weight: 750;
  cursor: pointer;
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

@media (max-width: 760px) {
  .play-area {
    grid-template-columns: minmax(0, 1fr);
  }

  .game-sidebar {
    order: -1;
    width: min(100%, 34rem);
    justify-self: center;
  }

  .game-header {
    text-align: center;
  }

  .game-brand {
    justify-content: center;
  }

  .game-description {
    max-width: 28rem;
    margin-right: auto;
    margin-left: auto;
  }

  .game-board-column {
    width: min(100%, 34rem);
  }
}

@media (max-width: 480px) {
  .game-brand {
    gap: 0.65rem;
  }

  .game-tutorial-overlay,
  .game-over-overlay {
    border-radius: 1rem;
  }

  .game-page {
    align-items: start;
    padding: 1.5rem 1rem;
  }

  .turn-counter {
    padding: 0.45rem 0.25rem;
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
