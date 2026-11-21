<template>
  <section class="admin-page">
    <header>
      <h1>Administration</h1>
      <p>Game analytics and configuration publishing</p>
    </header>

    <p v-if="initializing">Connecting to Firebase...</p>
    <template v-else>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <section v-if="user" class="admin-panel">
        <h2>Account</h2>
        <p>{{ user.isAnonymous ? 'Anonymous player' : (user.email || 'Signed-in player') }}</p>
        <p class="admin-uid">UID: <code>{{ user.uid }}</code></p>
        <p v-if="user.isAnonymous">Link this player to Google to keep its existing UID and saved games.</p>
        <p v-else-if="!isAdmin">This account does not currently have admin access.</p>
        <div class="admin-actions">
          <button v-if="user.isAnonymous" type="button" :disabled="busy" @click="linkGoogle">Link this player to Google</button>
          <button v-if="!isAdmin" type="button" :disabled="busy" @click="signInGoogle">Sign in with another Google account</button>
          <button v-if="!user.isAnonymous" type="button" :disabled="busy" @click="refreshAccess">Refresh admin access</button>
          <button type="button" :disabled="busy" @click="signOutAccount">Sign out</button>
        </div>
      </section>
      <section v-else class="admin-panel">
        <p>Sign in with your Google administrator account.</p>
        <button type="button" :disabled="busy" @click="signInGoogle">Sign in with Google</button>
      </section>

      <template v-if="isAdmin">
        <section class="admin-panel">
          <div class="admin-heading">
            <h2>Analytics</h2>
            <button type="button" :disabled="loadingData" @click="loadDashboard">Refresh</button>
          </div>
          <p>Client-reported data may be incomplete or inaccurate.</p>
          <p v-if="loadingData">Loading analytics...</p>
          <template v-else-if="dashboard">
            <p><strong>{{ dashboard.playerCount }}</strong> players · <strong>{{ dashboard.gameCount }}</strong> games</p>
            <h3>Recent games (up to 25)</h3>
            <div class="admin-table">
              <table>
                <thead><tr><th>Player</th><th>Started</th><th>Status</th><th>Turn</th><th>High score</th></tr></thead>
                <tbody>
                  <tr v-for="game in dashboard.games" :key="game.path">
                    <td>{{ game.username }}</td><td>{{ formatDate(game.startTime) }}</td>
                    <td>{{ game.status }}</td><td>{{ game.turn }}</td><td>{{ game.highScore }}</td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!dashboard.games.length">No games found.</p>
            </div>
            <h3>Players (first 25 by ID)</h3>
            <ul>
              <li v-for="player in dashboard.players" :key="player.id">
                {{ player.username }} <code>{{ player.id }}</code>
              </li>
            </ul>
            <p v-if="!dashboard.players.length">No players found.</p>
          </template>
        </section>

        <section class="admin-panel">
          <h2>Publish configuration</h2>
          <p>Published rules cannot be changed. Use a new ID for every rules change.</p>
          <form class="admin-form" @submit.prevent="publish" @invalid.capture="handleInvalid" @input="publishError = ''">
            <label for="config-id">Config ID</label>
            <input id="config-id" v-model="configId" required pattern="[a-zA-Z0-9_\-]+" maxlength="1500" placeholder="daily-2026-01-01" aria-describedby="config-id-help">
            <small id="config-id-help">Use letters, numbers, underscores, or hyphens; no spaces.</small>
            <label for="config-name">Name</label>
            <input id="config-name" v-model="configName" required placeholder="Daily challenge">
            <label for="config-rules">Rules JSON</label>
            <textarea id="config-rules" v-model="rulesJson" required rows="18" spellcheck="false" />
            <small><code>startingPlayerMonsterCount</code> and <code>startingEnemyMonsterCount</code> control the initial roster; set the enemy count to 0 for no starting enemies. Starting positions and types are selected deterministically from the run seed. Use <code>playerMonsterTypes</code> to control player monster types.</small>
            <p v-if="publishError" class="admin-error" role="alert">{{ publishError }}</p>
            <p v-if="published" role="status">{{ published }}</p>
            <div class="admin-actions">
              <button type="submit" :disabled="publishing">{{ publishing ? 'Publishing...' : 'Publish new configuration' }}</button>
              <button type="button" :disabled="publishing" @click="resetRules">Reset to standard rules</button>
            </div>
          </form>
          <h3>Published configurations</h3>
          <ul v-if="dashboard">
            <li v-for="config in dashboard.configs" :key="config.id" class="admin-config">
              <span>{{ config.name }} <code>{{ config.id }}</code>{{ config.archived ? ' (archived)' : '' }}</span>
              <button type="button" :disabled="publishing" @click="duplicateConfig(config.id)">Duplicate</button>
              <button type="button" :disabled="!!archivingId" @click="setArchived(config.id, !config.archived)">
                {{ config.archived ? 'Restore' : 'Archive' }}
              </button>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, linkWithPopup, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { Auth, User } from 'firebase/auth'
import { collection, collectionGroup, getCountFromServer, getDocs, getFirestore, limit, orderBy, query } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { Functions } from 'firebase/functions'
import { DEFAULT_GAME_CONFIG } from '~~/game/config'
import { parseAvailableConfig } from '~~/game/configValidation'
import type { GameConfig } from '~~/game/configValidation'

interface Dashboard {
  playerCount: number
  gameCount: number
  games: { path: string, username: string, startTime: number, status: string, turn: number | string, highScore: number | string }[]
  players: { id: string, username: string }[]
  configs: { id: string, name: string, archived: boolean, rules: GameConfig }[]
}

const runtime = useRuntimeConfig().public
useSeoMeta({ title: 'Swonster Administration', robots: 'noindex, nofollow' })
const toast = useToast()
const user = shallowRef<User | null>(null)
const isAdmin = ref(false)
const initializing = ref(true)
const busy = ref(false)
const loadingData = ref(false)
const publishing = ref(false)
const archivingId = ref('')
const error = ref('')
const publishError = ref('')
const published = ref('')
const dashboard = ref<Dashboard | null>(null)
const configId = ref('')
const configName = ref('')
const rulesJson = ref(JSON.stringify(DEFAULT_GAME_CONFIG, null, 2))
let auth: Auth | undefined
let database: Firestore | undefined
let functions: Functions | undefined
let unsubscribe: (() => void) | undefined
let authVersion = 0

function showError(text: string) {
  error.value = text
  toast.add({ title: 'Admin error', description: text, color: 'error' })
}

function showPublishError(text: string) {
  publishError.value = text
  const description = text.length > 200 ? `${text.slice(0, 200)}… See the form for details.` : text
  toast.add({ title: 'Could not publish configuration', description, color: 'error' })
}

function message(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'auth/credential-already-in-use') {
    return 'This Google account is already linked to another player. Sign in with that Google account instead; the anonymous player cannot be merged automatically.'
  }
  return cause instanceof Error ? cause.message : 'An unexpected error occurred.'
}

async function updateUser(current: User | null, forceRefresh = false) {
  const version = ++authVersion
  user.value = current
  isAdmin.value = false
  dashboard.value = null
  loadingData.value = false
  if (!current) return
  try {
    const token = await current.getIdTokenResult(forceRefresh)
    if (version !== authVersion) return
    isAdmin.value = token.claims.admin === true && token.signInProvider === 'google.com'
    if (isAdmin.value) await loadDashboard()
  } catch (cause) {
    if (version === authVersion) showError(`Could not check admin access: ${message(cause)}`)
  }
}

onMounted(() => {
  try {
    const { firebaseApiKey, firebaseAuthDomain, firebaseProjectId, firebaseAppId } = runtime
    if (!firebaseApiKey || !firebaseAuthDomain || !firebaseProjectId || !firebaseAppId) {
      throw new Error('Firebase configuration is missing.')
    }
    const app = getApps()[0] ?? initializeApp({
      apiKey: firebaseApiKey,
      authDomain: firebaseAuthDomain,
      projectId: firebaseProjectId,
      appId: firebaseAppId
    })
    auth = getAuth(app)
    database = getFirestore(app)
    functions = getFunctions(app, 'europe-west1')
    unsubscribe = onIdTokenChanged(auth, (current) => {
      initializing.value = false
      void updateUser(current)
    }, (cause) => {
      initializing.value = false
      showError(`Could not connect to Firebase: ${message(cause)}`)
    })
  } catch (cause) {
    initializing.value = false
    showError(`Could not connect to Firebase: ${message(cause)}`)
  }
})

onUnmounted(() => {
  authVersion++
  unsubscribe?.()
})

async function accountAction(action: () => Promise<unknown>) {
  busy.value = true
  error.value = ''
  try {
    await action()
  } catch (cause) {
    showError(`Account action failed: ${message(cause)}`)
  } finally {
    busy.value = false
  }
}

function signInGoogle() {
  if (auth) return accountAction(() => signInWithPopup(auth!, new GoogleAuthProvider()))
}

function linkGoogle() {
  if (auth?.currentUser?.isAnonymous) return accountAction(() => linkWithPopup(auth!.currentUser!, new GoogleAuthProvider()))
}

function signOutAccount() {
  if (auth) return accountAction(() => signOut(auth!))
}

function refreshAccess() {
  if (auth?.currentUser) return accountAction(() => updateUser(auth!.currentUser, true))
}

async function loadDashboard() {
  if (!database || !isAdmin.value) return
  const version = authVersion
  loadingData.value = true
  error.value = ''
  try {
    const players = collection(database, 'players')
    const games = collectionGroup(database, 'games')
    const [playerCount, gameCount, recentGames, playerSample, configs] = await Promise.all([
      getCountFromServer(players),
      getCountFromServer(games),
      getDocs(query(games, orderBy('startTime', 'desc'), limit(25))),
      getDocs(query(players, limit(25))),
      getDocs(collection(database, 'configs'))
    ])
    if (version !== authVersion) return
    dashboard.value = {
      playerCount: playerCount.data().count,
      gameCount: gameCount.data().count,
      games: recentGames.docs.map((entry) => {
        const data = entry.data()
        return {
          path: entry.ref.path,
          username: typeof data.username === 'string' ? data.username : 'Unknown',
          startTime: typeof data.startTime === 'number' ? data.startTime : 0,
          status: typeof data.status === 'string' ? data.status : 'Unknown',
          turn: typeof data.turn === 'number' ? data.turn : '—',
          highScore: typeof data.highScore === 'number' ? data.highScore : '—'
        }
      }),
      players: playerSample.docs.map(entry => ({
        id: entry.id,
        username: typeof entry.data().username === 'string' ? entry.data().username : 'Unknown'
      })),
      configs: configs.docs.map((entry) => {
        const config = parseAvailableConfig(entry.id, entry.data())
        return { id: config.id, name: config.name, archived: config.archived === true, rules: config.rules }
      }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    }
  } catch (cause) {
    if (version === authVersion) showError(`Could not load analytics: ${message(cause)}`)
  } finally {
    if (version === authVersion) loadingData.value = false
  }
}

function formatDate(time: number) {
  return time && Number.isFinite(time) ? new Date(time).toLocaleString() : 'Unknown'
}

function resetRules() {
  rulesJson.value = JSON.stringify(DEFAULT_GAME_CONFIG, null, 2)
  publishError.value = ''
}

function getDuplicateConfigId(id: string): string {
  const existingIds = new Set(dashboard.value?.configs.map(config => config.id))
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '-')
  let suffix = '-copy'
  let copyId = `${safeId.slice(0, 1500 - suffix.length)}${suffix}`
  let index = 2

  while (existingIds.has(copyId)) {
    suffix = `-copy-${index++}`
    copyId = `${safeId.slice(0, 1500 - suffix.length)}${suffix}`
  }

  return copyId
}

function duplicateConfig(id: string) {
  const config = dashboard.value?.configs.find(entry => entry.id === id)
  if (!config) {
    showPublishError(`Could not find configuration ${id}. Refresh the dashboard and try again.`)
    return
  }

  configId.value = getDuplicateConfigId(config.id)
  configName.value = `${config.name} copy`
  rulesJson.value = JSON.stringify(config.rules, null, 2)
  publishError.value = ''
  published.value = ''
  toast.add({
    title: 'Configuration copied to editor',
    description: `Edit the copy of ${config.name} and publish it with a new ID.`,
    color: 'success'
  })
}

function handleInvalid(event: Event) {
  published.value = ''
  const field = event.target
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || publishError.value) return
  const label = field.labels?.[0]?.textContent?.trim() || 'Field'
  showPublishError(`${label}: ${field.validationMessage}`)
}

async function publish() {
  published.value = ''
  if (!functions || !isAdmin.value) {
    showPublishError('Admin access is unavailable. Refresh the page and sign in again.')
    return
  }
  publishing.value = true
  publishError.value = ''
  try {
    const rules: unknown = JSON.parse(rulesJson.value)
    parseAvailableConfig(configId.value, { name: configName.value, rules })
    const call = httpsCallable<{ id: string, name: string, rules: unknown }, { id: string }>(functions, 'publishConfig')
    const result = await call({ id: configId.value, name: configName.value, rules })
    published.value = `Published configuration ${result.data.id}.`
    await loadDashboard()
  } catch (cause) {
    showPublishError(message(cause))
  } finally {
    publishing.value = false
  }
}

async function setArchived(id: string, archived: boolean) {
  if (!functions || !isAdmin.value) {
    showError('Admin access is unavailable. Refresh the page and sign in again.')
    return
  }
  const version = authVersion
  archivingId.value = id
  try {
    const call = httpsCallable<{ id: string, archived: boolean }, { id: string, archived: boolean }>(functions, 'setConfigArchived')
    await call({ id, archived })
    if (version !== authVersion) return
    const config = dashboard.value?.configs.find(entry => entry.id === id)
    if (config) config.archived = archived
    toast.add({ title: archived ? 'Configuration archived' : 'Configuration restored', color: 'success' })
  } catch (cause) {
    if (version === authVersion) showError(`Could not ${archived ? 'archive' : 'restore'} configuration: ${message(cause)}`)
  } finally {
    archivingId.value = ''
  }
}
</script>

<style scoped>
.admin-page { width: min(100%, 70rem); display: grid; gap: 1.5rem; }
.admin-page h1 { font-size: 2rem; font-weight: 700; }
.admin-page h2 { font-size: 1.3rem; font-weight: 700; }
.admin-page h3 { font-weight: 700; margin-top: 1rem; }
.admin-page p { margin: 0.4rem 0; }
.admin-panel { display: grid; gap: 0.5rem; padding: 1.25rem; border: 1px solid var(--ui-border); border-radius: 0.75rem; background: var(--ui-bg); }
.admin-heading, .admin-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.admin-heading { justify-content: space-between; }
.admin-page button { cursor: pointer; padding: 0.45rem 0.75rem; border: 1px solid var(--ui-border); border-radius: 0.4rem; }
.admin-page button:disabled { opacity: 0.5; cursor: not-allowed; }
.admin-form { display: grid; gap: 0.5rem; }
.admin-form input, .admin-form textarea { width: 100%; padding: 0.5rem; border: 1px solid var(--ui-border); border-radius: 0.4rem; }
.admin-form textarea, .admin-page code { font-family: monospace; }
.admin-uid { overflow-wrap: anywhere; }
.admin-error { color: var(--ui-color-error-600); overflow-wrap: anywhere; }
.admin-table { overflow-x: auto; }
.admin-config { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin: 0.5rem 0; overflow-wrap: anywhere; }
.admin-page table { width: 100%; text-align: left; }
.admin-page th, .admin-page td { padding: 0.4rem; border-bottom: 1px solid var(--ui-border); }
</style>
