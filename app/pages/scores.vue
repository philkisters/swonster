<template>
  <section class="game-score-page" aria-labelledby="score-title">
    <header class="game-score-header">
      <button
        type="button"
        class="game-score-back"
        aria-label="Back to menu"
        @click="router.push('/')"
      >
        <UIcon name="i-lucide-chevron-left" />
      </button>
      <GameLogo />
      <h1 id="score-title">Scores</h1>
    </header>

    <label for="score-config">Game configuration</label>
    <select id="score-config" v-model="selectedConfig" :disabled="configsLoading">
      <option v-for="config in configs" :key="config.id" :value="config.id">{{ config.name }}{{ config.archived ? ' (archived)' : '' }}</option>
      <option value="__legacy__">Legacy games</option>
    </select>

    <div class="game-score-switcher" role="group" aria-label="History order">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :class="{ 'game-score-switcher-active': view === option.value }"
        :aria-pressed="view === option.value"
        @click="view = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <MenuLoading v-if="loading" text="Loading games..." :size="8" />
    <p v-else-if="historyError" class="game-score-error" role="alert">
      {{ historyError }}
    </p>
    <p v-else-if="games.length === 0" class="game-score-empty">
      {{ view === 'latest' ? 'You have not played any saved games yet.' : 'Finish a game to set your first high score.' }}
    </p>
    <ol v-else class="game-score-list">
      <li
        v-for="game in games"
        :key="game.id"
        class="game-score-card"
        :class="{ 'game-score-card-incomplete': isIncomplete(game) }"
      >
        <div class="game-score-result">
          <div v-if="view === 'best-global'"  class="text-xl font-semibold">
            {{ game.username ?? 'Unknown player' }}
          </div>
          <div class="game-score-score">
            <img
              :src="`${app.baseURL}sprites/ui/score.png`"
              alt=""
              width="128"
              height="128"
            >
            <span>
              <small>High score</small>
              <strong>{{ game.highScore }}</strong>
            </span>
          </div>
          <div class="game-score-turn">
            <img
              :src="`${app.baseURL}sprites/ui/turn.png`"
              alt=""
              width="128"
              height="128"
            >
            <span>
              <small>Turn</small>
              <strong>{{ game.turn }}</strong>
            </span>
          </div>
        </div>
        <div class="game-score-meta">
          <span>
            {{ isIncomplete(game) ? 'Started' : 'Finished' }}
            {{ formatDate(displayTime(game)) }}
          </span>
          <span>{{ formatDuration(game) }}</span>
        </div>
      </li>
    </ol>
  </section>
</template>

<script lang="ts" setup>
import type { GameHistoryEntry, HistoryOrder } from '~/composables/useGameTracking'
import type { AvailableConfig } from '~~/game/configValidation'

const options: { value: HistoryOrder, label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'best-personal', label: 'Personal' },
  { value: 'best-global', label: 'Global' }
]

const route = useRoute()
const router = useRouter()
const { app } = useRuntimeConfig()
const { connect, loadHistory, loadConfigs, ready } = useGameTracking()
const configs = ref<AvailableConfig[]>([])
const configsLoading = ref(true)
const selectedConfig = ref(typeof route.query.config === 'string' ? route.query.config : '__legacy__')
const requestedView = route.query.view
const view = ref<HistoryOrder>(
  requestedView === 'best-personal' || requestedView === 'best'
    ? 'best-personal'
    : requestedView === 'best-global' ? 'best-global' : 'latest',
)
const games = ref<GameHistoryEntry[]>([])
const loading = ref(true)
const historyError = ref('')
let requestId = 0

function isIncomplete(game: GameHistoryEntry): boolean {
  return game.status === 'abandoned' || game.endTime === null
}

function displayTime(game: GameHistoryEntry): number {
  return isIncomplete(game) ? game.startTime : (game.endTime ?? game.startTime)
}

function formatDate(value: number): string {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value)
}

function formatDuration(game: GameHistoryEntry): string {
  const end = game.endTime ?? Date.now()
  const totalSeconds = Math.max(0, Math.floor((end - game.startTime) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

async function refreshHistory() {
  const currentRequest = ++requestId
  loading.value = true
  historyError.value = ''
  try {
    const result = await loadHistory(view.value, selectedConfig.value)
    if (currentRequest === requestId) games.value = result
  } catch (cause) {
    console.error('Could not load game history.', cause)
    if (currentRequest === requestId) {
      historyError.value = 'Could not load your game history. Please try again.'
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch([view, selectedConfig], () => {
  if (!configsLoading.value) void refreshHistory()
})

onMounted(async () => {
  await connect()
  if (ready.value) {
    try {
      configs.value = await loadConfigs(true)
      if (selectedConfig.value !== '__legacy__' && !configs.value.some(config => config.id === selectedConfig.value)) {
        selectedConfig.value = '__legacy__'
      }
    } catch (cause) {
      console.error('Could not load game configurations.', cause)
      historyError.value = 'Could not load game configurations. Return to the menu and try again.'
      loading.value = false
      return
    } finally {
      configsLoading.value = false
    }
  } else {
    configsLoading.value = false
  }
  await refreshHistory()
})
</script>

<style scoped>
.game-score-page {
  display: grid;
  width: min(100%, 34rem);
  align-self: start;
  gap: 1.25rem;
}

.game-score-header {
  display: grid;
  grid-template-columns: 2.5rem 4rem minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.game-score-header h1 {
  margin: 0;
  font-size: clamp(1.5rem, 6vw, 2rem);
  font-weight: 850;
}

.game-score-header :deep(.game-logo) {
  width: 4rem;
  height: 4rem;
}

.game-score-back {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 0;
  border-radius: 0.7rem;
  background: var(--ui-bg-elevated);
  cursor: pointer;
}

.game-score-back svg {
  width: 1.5rem;
  height: 1.5rem;
}

.game-score-switcher {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 0.25rem;
  border: 1px solid var(--ui-border);
  border-radius: 0.8rem;
  background: var(--ui-bg-muted);
}

.game-score-switcher button {
  min-width: 0;
  padding: 0.65rem 0.5rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--ui-text-muted);
  font-weight: 750;
  white-space: nowrap;
  cursor: pointer;
}

.game-score-switcher .game-score-switcher-active {
  background: var(--ui-bg-elevated);
  box-shadow: 0 0.2rem 0.8rem color-mix(in srgb, var(--ui-color-primary-950) 8%, transparent);
  color: var(--ui-text-highlighted);
}

.game-score-list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.game-score-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1rem;
  background: var(--ui-bg-elevated);
  box-shadow: 0 0.5rem 1.5rem color-mix(in srgb, var(--ui-color-primary-950) 5%, transparent);
}

.game-score-card-incomplete {
  border-color: var(--game-damage-text);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--game-damage-text) 18%, transparent),
    0 0.5rem 1.5rem color-mix(in srgb, var(--ui-color-primary-950) 5%, transparent);
}

.game-score-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
}

.game-score-score,
.game-score-turn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.game-score-score img,
.game-score-turn img {
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.game-score-score span,
.game-score-turn span {
  display: grid;
}

.game-score-card small {
  color: var(--ui-text-muted);
  font-size: 0.65rem;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.game-score-card strong {
  color: var(--ui-text-highlighted);
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.game-score-turn strong {
  color: var(--game-turn-text);
  text-align: right;
}

.game-score-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.game-score-meta span:last-child {
  flex: 0 0 auto;
}

.game-score-error {
  color: var(--game-damage-text);
  text-align: center;
}

.game-score-empty {
  margin: 1rem 0;
  color: var(--ui-text-muted);
  text-align: center;
}

@media (max-width: 400px) {
  .game-score-card {
    padding: 0.85rem;
  }

  .game-score-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>