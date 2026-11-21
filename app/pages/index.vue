<template>
  <section class="game-menu" aria-label="Main menu">
    <MenuHeader class="mb-6" />

    <template v-if="!ready && error === ''">
      <MenuLoading text="Loading game data..." :size="8" />
    </template>

    <template v-if="!loading && ready">
      <div class="text-center text-xl">
        Welcome to Swonster!
      </div>
      <form
        class="game-menu-username"
        @submit.prevent="saveUsername(username)"
      >
        <input
          id="username"
          v-model="username"
          class="text-center"
          maxlength="32"
          required
        />
        <button v-if="hasUnsavedUsername" type="submit" :disabled="loading">
          Save username
        </button>
      </form>
      <button
        v-if="hasActiveGame"
        type="button"
        class="game-menu-button-primary"
        :disabled="loading"
        @click="router.push({ path: '/game', query: { resume: '1' } })"
      >
        Resume Game
      </button>
      <p v-if="activeGameError" class="game-menu-error" role="alert">{{ activeGameError }}</p>
      <button v-if="activeGameError" type="button" @click="loadActive">Retry loading saved game</button>
      <div class="game-modes" role="group" aria-label="Game configuration">
        <button
          v-for="config in configs"
          :key="config.id"
          type="button"
          class="game-mode"
          :class="{ 'game-mode-selected': selectedConfig === config.id }"
          :disabled="configsLoading"
          :aria-label="`${config.name} (${config.id})`"
          :aria-pressed="selectedConfig === config.id"
          :title="config.name"
          @click="selectedConfig = config.id"
        >
          <img
            v-if="!failedSprites.has(config.id)"
            :src="spriteUrl(gameModeSpritePath(config.id))"
            alt=""
            @error="failedSprites.add(config.id)"
          />
          <span v-else class="game-mode-fallback">
            <UIcon name="i-lucide-cog" class="game-mode-icon" aria-hidden="true" />
            <span>{{ config.name }}</span>
          </span>
        </button>
      </div>
      <p v-if="configError" class="game-menu-error" role="alert">{{ configError }}</p>
      <button v-if="configError" type="button" @click="loadAvailableConfigs">Retry loading configurations</button>
      <button
        type="button"
        class="game-menu-button-primary"
        :disabled="loading || configsLoading || !selectedConfig"
        @click="startGame"
      >
        New Game
      </button>
      <button
        type="button"
        class="game-menu-button-secondary"
        :disabled="loading"
        @click="router.push({ path: '/scores', query: { config: selectedConfig || '__legacy__' } })"
      >
        History
      </button>
      
      <button
        type="button"
        class="game-menu-button-secondary"
        :disabled="loading"
        @click="router.push({ path: '/scores', query: { view: 'best-personal', config: selectedConfig || '__legacy__' } })"
      >
        High Scores
      </button>
    </template>
    <template v-if="!ready && error !== ''">
      <button type="button" @click="connectAndLoad">
        Retry connection
      </button>
      <button type="button" class="game-menu-button-primary" @click="startGame">
        Play without saving
      </button>
    </template>
    <p v-if="error" class="game-menu-error" role="alert">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import type { AvailableConfig } from '~~/game/configValidation'
import { gameModeSpritePath, selectGameMode } from '~/utils/gameModes'

const {
  username,
  ready,
  loading,
  error,
  hasUnsavedUsername,
  connect,
  saveUsername,
  loadConfigs,
  loadActiveGame,
} = useGameTracking()

const router = useRouter()
const spriteUrl = useSpriteUrl()
const configs = ref<AvailableConfig[]>([])
const selectedConfig = ref('')
const failedSprites = ref(new Set<string>())
const configError = ref('')
const configsLoading = ref(false)
const hasActiveGame = ref(false)
const activeGameError = ref('')

function startGame() {
  if (!ready.value) {
    router.push({ path: '/game', query: { offline: '1' } })
    return
  }
  if (selectedConfig.value) router.push({ path: '/game', query: { config: selectedConfig.value } })
}

async function loadAvailableConfigs() {
  configsLoading.value = true
  configError.value = ''
  try {
    configs.value = await loadConfigs()
    failedSprites.value = new Set()
    selectedConfig.value = selectGameMode(configs.value, selectedConfig.value)
    if (!configs.value.length) configError.value = 'No active game configurations are available. Ask an administrator to publish or restore one.'
  } catch (cause) {
    console.error('Could not load game configurations.', cause)
    configs.value = []
    selectedConfig.value = ''
    configError.value = 'Could not load game configurations. Please try again.'
  } finally {
    configsLoading.value = false
  }
}

async function connectAndLoad() {
  await connect()
  if (ready.value) await Promise.all([loadAvailableConfigs(), loadActive()])
}

async function loadActive() {
  activeGameError.value = ''
  try {
    hasActiveGame.value = Boolean(await loadActiveGame())
  } catch (cause) {
    console.error('Could not load the saved game.', cause)
    hasActiveGame.value = false
    activeGameError.value = 'Could not load your saved game. Please try again.'
  }
}

onMounted(() => void connectAndLoad())
</script>

<style scoped>
.game-menu {
  display: grid;
  width: min(100%, 28rem);
  gap: 1rem;
  padding: 1.5rem;
}

.game-menu h1,
.game-menu p {
  margin: 0;
}

.game-menu-username {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 3rem;
}

.game-menu-username input {
  width: 75%;
  justify-self: center;
}

.game-menu input,
.game-menu button {
  padding: 0.7rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.7rem;
}

.game-menu button {
  cursor: pointer;
}

.game-menu button:disabled {
  cursor: wait;
}

.game-modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.game-menu .game-mode {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 3px solid transparent;
}

.game-menu .game-mode-selected {
  border-color: var(--game-gold-text);
}

.game-mode img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.game-mode-fallback {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  overflow-wrap: anywhere;
}

.game-mode-icon {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
}

.game-menu-button-primary {
  border: 0;
  font-weight: 750;
  background: var(--game-accent-strong);
  color: var(--ui-text-inverted);
}
  
button.game-menu-button-secondary {
  border: 0;
  font-weight: 750;
  border: 1px solid var(--game-gold-text);
}

.game-menu-error {
  color: var(--game-damage-text);
}
</style>
