<template>
  <main class="game-page">
    <div class="game-shell">
      <GameHeader
        :score="state.score"
        :gold="state.gold"
        :xp="state.xp"
      />

      <section
        class="play-area"
        aria-label="Game"
      >
        <div class="game-board-column">
          <GameSpawnTimeline
            :history="spawnHistory"
            :queue="state.spawnQueue"
            :turn="state.turn"
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
                class="pixel-button pixel-button--primary"
                @click="restartGame"
              >
                New game
              </button>
            </section>
          </div>
          <GameSpellBar
            :cards="spellCards"
            :targeting="targeting"
            :disabled="showTutorial || state.gameOver"
            @select="selectSpell"
            @cancel="cancelSpell"
          />
          <section
            v-if="!state.gameOver && state.cells.every(monster => monster !== null)"
            class="game-over-card pixel-frame"
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
              class="pixel-button pixel-button--primary"
              @click="restartGame"
            >
              New game
            </button>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import type { Direction } from '../../game/types'

const showTutorial = ref(true)

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
  finishMergeAnimations,
  finishAttackAnimations,
  finishSpawnAnimation,
  finishSpellEffect,
  finishHealthPopup
} = useGame()

const {
  cards: spellCards,
  targeting,
  select: selectSpell,
  pick: pickTarget,
  cancel: cancelSpell
} = useSpellCasting(state, isAnimating, cast)

function moveWhenReady(direction: Direction) {
  if (!showTutorial.value && !targeting.value) move(direction)
}

function restartGame() {
  cancelSpell()
  restart()
}

useGameInput(moveWhenReady, cancelSpell)
</script>

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
  --game-turn-text: var(--ui-color-error-600);
  --game-score-text: var(--ui-text-highlighted);
  --game-gold-text: var(--ui-color-warning-600);
  --game-xp-text: var(--ui-color-success-600);
  --game-target: var(--ui-text-highlighted);
  --game-damage-text: var(--ui-color-error-600);
  --game-heal-text: var(--ui-color-success-600);
  font-synthesis: none;
}

.dark {
  color-scheme: dark;
  --game-accent-text: var(--ui-color-primary-300);
  --game-accent-strong: var(--ui-color-primary-400);
  --game-enemy-text: var(--ui-color-warning-300);
  --game-enemy-strong: var(--ui-color-warning-400);
  --game-player-bg: color-mix(in srgb, var(--ui-color-primary-500) 24%, var(--ui-bg));
  --game-enemy-bg: color-mix(in srgb, var(--ui-color-warning-500) 24%, var(--ui-bg));
  --game-turn-text: var(--ui-color-error-400);
  --game-score-text: #fff;
  --game-gold-text: var(--ui-color-warning-400);
  --game-xp-text: var(--ui-color-success-400);
  --game-damage-text: var(--ui-color-error-400);
  --game-heal-text: var(--ui-color-success-400);
}

.light {
  color-scheme: light;
}

body {
  min-width: 320px;
  min-height: 100vh;
  margin: 0;
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath fill='%2364748b' fill-opacity='.16' d='M0 0h3v3H0zM12 12h3v3h-3z'/%3E%3C/svg%3E"),
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
  display: grid;
  width: min(100%, calc(552px + var(--px) * 2));
  grid-template-columns: minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 2rem);
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
  background: var(--ui-bg);
  inset: 0;
  text-align: center;
}

.game-over-overlay h2 {
  margin: 0;
  font-size: clamp(1.75rem, 6vw, 2.5rem);
  font-weight: 700;
  line-height: 1.1;
}

.game-over-overlay p {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 1rem;
}

.game-over-score {
  display: flex;
  flex-direction: column;
  color: var(--game-accent-text);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.game-over-score strong {
  color: var(--ui-text-highlighted);
  font-size: clamp(2.5rem, 10vw, 4rem);
  letter-spacing: 0;
  line-height: 1.1;
}

.game-over-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: var(--px);
  padding: 0.85rem 1rem;
  background: var(--ui-bg-elevated);
}

.game-over-card h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.game-over-card p {
  margin: 0.25rem 0 0;
  color: var(--ui-text-muted);
  font-size: 0.95rem;
  line-height: 1.25;
}

.game-over-card .pixel-button {
  flex: 0 0 auto;
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
  background: var(--ui-bg-elevated);
}

.control-icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
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
  .game-page {
    align-items: start;
    padding-top: 0.75rem;
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
