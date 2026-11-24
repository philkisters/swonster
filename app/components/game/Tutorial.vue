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
      <img
        v-if="currentTutorialStep.sprite"
        :key="currentTutorialStep.sprite"
        class="game-tutorial-icon"
        :src="spriteUrl(currentTutorialStep.sprite)"
        alt=""
        draggable="false"
      >
      <PixelIcon
        v-else-if="currentTutorialStep.icon"
        class="game-tutorial-icon"
        :name="currentTutorialStep.icon"
      />
      <h2 id="tutorial-title">
        {{ currentTutorialStep.title }}
      </h2>
      <p>{{ currentTutorialStep.description }}</p>
    </div>
    <div class="game-tutorial-actions">
      <button
        v-if="tutorialStep > 0"
        type="button"
        class="pixel-button"
        @click="tutorialStep--"
      >
        Back
      </button>
      <button
        v-else
        type="button"
        class="pixel-button"
        @click="emit('close')"
      >
        Skip Tutorial
      </button>
      <button
        type="button"
        class="pixel-button pixel-button--primary"
        @click="advanceTutorial"
      >
        {{ tutorialStep < tutorialSteps.length - 1 ? 'Next' : 'I understand' }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { PixelIconName } from '~/components/PixelIcon.vue'

interface TutorialStep {
  title: string
  description: string
  sprite?: string
  icon?: PixelIconName
}

const emit = defineEmits(['close'])
const spriteUrl = useSpriteUrl()

const tutorialSteps: TutorialStep[] = [
  {
    sprite: '/logo.png',
    title: 'Welcome to Swonster',
    description: 'Fight the yellow monsters on the board.'
  },
  {
    sprite: '/sprites/ui/turn.png',
    title: 'Survive each turn',
    description: 'If you lose all your monsters, or no new monster can spawn, the game ends.'
  },
  {
    sprite: '/sprites/ui/score.png',
    title: 'Highscore',
    description: 'You achieve points, by merging your monsters and defeating enemy monsters.'
  },
  {
    icon: 'arrows',
    title: 'How to move',
    description: 'Use the arrow keys or WASD, or swipe on the board. All movable monsters slide in the chosen direction.'
  },
  {
    icon: 'sword',
    title: 'Attack',
    description: 'Move towards an enemy to attack. Monsters attack opposing monsters next to them in the direction of movement.'
  },
  {
    icon: 'counter',
    title: 'Counterattack',
    description: 'A monster that survives an attack strikes back if it did not already attack that turn.'
  },
  {
    sprite: '/sprites/heads/skeleton-dragon-level-1.png',
    title: 'Upcoming spawns',
    description: 'The timeline shows the next monsters to spawn.'
  },
  {
    sprite: '/sprites/spells/fireball.png',
    title: 'Spells',
    description: 'Every 5 turns a new spell card appears below the board until all slots are full. Tap a card to buy it with gold, then pick its targets. Hold a card to read what it does.'
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
  font-size: 0.85rem;
  font-weight: 700;
}

.game-tutorial-content .game-tutorial-icon {
  width: 64px;
  height: 64px;
  color: var(--game-accent-text);
  object-fit: contain;
}

.game-tutorial-overlay h2 {
  margin: 0;
  font-size: clamp(1.5rem, 5vw, 2rem);
  font-weight: 700;
  line-height: 1.1;
}

.game-tutorial-overlay p {
  max-width: 22rem;
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 1rem;
  line-height: 1.3;
}

.game-tutorial-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}
</style>
