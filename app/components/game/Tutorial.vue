<template>
  <div
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
        v-else
        type="button"
        class="game-tutorial-back"
        @click="emit('close')"
      >
        Skip Tutorial
      </button>
      <button
        type="button"
        class="game-over-restart"
        @click="advanceTutorial"
      >
        {{ tutorialStep < tutorialSteps.length - 1 ? 'Next' : 'I understand' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>

const emit = defineEmits(['close'])

const tutorialSteps = [
  {
    icon: '💡',
    title: 'Welcome to Swonster',
    description: 'Fight the yellow monsters on the board.'
  },
  {
    icon: '⏳',
    title: 'Survive each turn',
    description: 'If you lose all your monsters, or no new monster can spawn, the game ends.'
  },
  {
    icon: '🏆',
    title: 'Highscore',
    description: 'You achieve points, by merging your monsters and defeating enemy monsters.'
  },
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
    description: 'The timeline shows the next monsters to spawn.'
  }
]
const tutorialStep = ref(0)

const currentTutorialStep = computed(() => {
  const step = tutorialSteps[tutorialStep.value]
  if (!step) throw new Error('Invalid tutorial step')
  return step
})

function advanceTutorial() {
  if (tutorialStep.value < tutorialSteps.length - 1) {
    tutorialStep.value++
  } else {
    emit('close')
  }
}
</script>

<style>
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
</style>
