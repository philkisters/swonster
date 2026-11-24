import { getApps, initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { DocumentReference, Firestore } from 'firebase/firestore'
import type { GameState, SpawnEntry } from '~~/game/types'
import { gameStateSchema, persistedGameStateSchema, spawnHistorySchema } from '../../game/stateValidation'
import { parseAvailableConfig } from '../../game/configValidation'
import type { AvailableConfig } from '../../game/configValidation'
import type { GameAction } from './useGame'

export type HistoryOrder = 'latest' | 'best-personal' | 'best-global'

export class ArchivedConfigError extends Error {
  constructor() {
    super('This configuration is archived. Return to the menu and choose another.')
    this.name = 'ArchivedConfigError'
  }
}

export class MissingConfigError extends Error {
  constructor(id: string) {
    super(`The saved game's configuration could not be found: ${id}. Return to the main menu.`)
    this.name = 'MissingConfigError'
  }
}

export interface GameHistoryEntry {
  id: string
  username?: string
  startTime: number
  endTime: number | null
  turn: number
  highScore: number
  status: string
}

interface Session {
  reference: DocumentReference
  step: number
  highScore: number
  ended: boolean
}

export interface SavedGame {
  state: GameState
  history: SpawnEntry[]
  config: AvailableConfig
  usesArchivedConfig: boolean
}

/**
 * Connects to Firebase for player profiles, configurations, scores and saved games.
 * With `saveGames: false` it never writes game data: no game is started, updated or ended in Firestore.
 */
export function useGameTracking({ saveGames = true }: { saveGames?: boolean } = {}) {
  const config = useRuntimeConfig().public
  const username = ref('')
  const savedUsername = ref('')
  const ready = ref(false)
  const loading = ref(false)
  const error = ref('')
  const saveError = ref('')
  const pendingWrites = ref(0)
  let database: Firestore | undefined
  let playerId: string | undefined
  let session: Session | undefined

  function reportError(message: string, cause: unknown) {
    console.error(message, cause)
    error.value = message
  }

  let writeQueue = Promise.resolve()
  let writeFailure: unknown

  async function connect() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      const {
        firebaseApiKey,
        firebaseAuthDomain,
        firebaseProjectId,
        firebaseAppId,
      } = config
      if (
        !firebaseApiKey ||
        !firebaseAuthDomain ||
        !firebaseProjectId ||
        !firebaseAppId
      ) {
        throw new Error('Firebase configuration is missing.')
      }
      const app =
        getApps()[0] ??
        initializeApp({
          apiKey: firebaseApiKey,
          authDomain: firebaseAuthDomain,
          projectId: firebaseProjectId,
          appId: firebaseAppId,
        })
      const auth = getAuth(app)
      await auth.authStateReady()
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user
      const firestore = getFirestore(app)
      const player = doc(firestore, 'players', user.uid)
      const snapshot = await getDoc(player)
      if (snapshot.exists()) {
        const name = snapshot.data().username
        if (typeof name !== 'string' || !name.trim())
          throw new Error('Invalid player profile.')
        username.value = name
        savedUsername.value = name
      } else {
        const name = `anonymous-swonster#${user.uid.slice(0, 5).toLowerCase()}`
        await setDoc(player, { username: name }, { merge: true })
        username.value = name
        savedUsername.value = name
      }
      database = firestore
      playerId = user.uid
      ready.value = true
    } catch (cause) {
      reportError(
        'Could not connect to Firebase. You can retry or play without saving.',
        cause,
      )
    } finally {
      loading.value = false
    }
  }

  async function saveUsername(value: string) {
    const name = value.trim()
    if (!name || name.length > 32) {
      error.value = 'Enter a username between 1 and 32 characters.'
      return
    }
    if (!database || !playerId) {
      error.value = 'Connect to Firebase before saving your username.'
      return
    }
    error.value = ''
    loading.value = true
    try {
      await updateDoc(doc(database, 'players', playerId), { username: name })
      username.value = name
      savedUsername.value = name
    } catch (cause) {
      reportError('Could not save your username. Please try again.', cause)
    } finally {
      loading.value = false
    }
  }

  async function loadConfigs(includeArchived = false): Promise<AvailableConfig[]> {
    if (!database || !ready.value) throw new Error('Connect to Firebase before loading configurations.')
    const snapshot = await getDocs(collection(database, 'configs'))
    return snapshot.docs.map(entry => parseAvailableConfig(entry.id, entry.data()))
      .filter(config => includeArchived || !config.archived)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  }

  async function loadConfig(id: string, includeArchived = false): Promise<AvailableConfig> {
    if (!database || !ready.value) throw new Error('Connect to Firebase before loading a configuration.')
    const snapshot = await getDocFromServer(doc(database, 'configs', id))
    if (!snapshot.exists()) throw new MissingConfigError(id)
    const config = parseAvailableConfig(id, snapshot.data())
    if (config.archived && !includeArchived) throw new ArchivedConfigError()
    return config
  }

  async function loadHistory(order: HistoryOrder, configId?: string): Promise<GameHistoryEntry[]> {
    if (!database || !playerId || !ready.value) {
      throw new Error('Connect to Firebase before loading your history.')
    }

    const games = order === 'best-global'
      ? collectionGroup(database, 'games')
      : collection(database, 'players', playerId, 'games')
    const constraints = [
      ...(configId && configId !== '__legacy__' ? [where('configId', '==', configId)] : []),
      ...(order === 'latest' ? [] : [where('status', '==', 'game-over')]),
      orderBy(order === 'latest' ? 'startTime' : 'highScore', 'desc'),
      ...(configId === '__legacy__' ? [] : [limit(10)]),
    ]
    const historyQuery = query(games, ...constraints)
    const snapshot = await getDocs(historyQuery)
    const matchingDocs = snapshot.docs
      .filter(entry => configId !== '__legacy__' || !('configId' in entry.data()))
    const entries = await Promise.all((configId === '__legacy__' ? matchingDocs.slice(0, 10) : matchingDocs)
      .map(async (entry) => {
      const data = entry.data()
      const startTime = typeof data.startTime === 'number' ? data.startTime : 0
      const endTime = typeof data.endTime === 'number' ? data.endTime : null
      const turn = typeof data.turn === 'number' ? data.turn : 0
      const highScore = typeof data.highScore === 'number' ? data.highScore : 0
      const status = typeof data.status === 'string' ? data.status : 'active'
      let username = typeof data.username === 'string' ? data.username : undefined

      // Games saved before global scores were added do not contain a username copy.
      if (order === 'best-global' && !username && entry.ref.parent.parent) {
        const player = await getDoc(entry.ref.parent.parent)
        const profileName = player.data()?.username
        if (typeof profileName === 'string') username = profileName
      }

      return {
        id: entry.id,
        ...(username ? { username } : {}),
        startTime,
        endTime,
        turn,
        highScore,
        status,
      }
      }))

    if (order === 'latest') return entries.slice(0, 10)

    return entries
      .sort((first, second) =>
        second.highScore - first.highScore || second.startTime - first.startTime,
      )
      .slice(0, 10)
  }

  async function loadActiveGame(): Promise<SavedGame | null> {
    if (!database || !playerId || !ready.value) throw new Error('Connect to Firebase before loading a game.')
    const player = await getDocFromServer(doc(database, 'players', playerId))
    const activeGameId: unknown = player.data()?.activeGameId
    if (activeGameId === null || activeGameId === undefined) return null
    if (typeof activeGameId !== 'string' || !activeGameId || activeGameId.includes('/')) {
      throw new Error('Invalid active game reference.')
    }
    const reference = doc(database, 'players', playerId, 'games', activeGameId)
    const snapshot = await getDocFromServer(reference)
    if (!snapshot.exists()) throw new Error('The active game could not be found.')
    const data = snapshot.data()
    if (data.status !== 'active') throw new Error('The active game is no longer available.')
    if (typeof data.configId !== 'string' || !data.configId) {
      throw new Error('The saved game has no configuration reference.')
    }
    const config = await loadConfig(data.configId, true)
    const persistedState = persistedGameStateSchema.parse(data.state)
    const state = gameStateSchema.parse({ ...persistedState, config: config.rules })
    const history = spawnHistorySchema.parse(data.spawnHistory)
    if (state.gameOver || !Number.isSafeInteger(data.step) || data.step < 0
      || typeof data.highScore !== 'number' || !Number.isFinite(data.highScore)) {
      throw new Error('The saved game is invalid.')
    }
    session = { reference, step: data.step, highScore: data.highScore, ended: false }
    return {
      state,
      history,
      config,
      usesArchivedConfig: config.archived === true,
    }
  }

  async function begin(initialSeed: number, config: AvailableConfig, state: unknown, history: readonly SpawnEntry[]) {
    if (!saveGames) return
    if (!database || !playerId || !ready.value) throw new Error('Connect to Firebase before starting a game.')
    await end()
    const firestore = database
    const player = doc(firestore, 'players', playerId)
    const games = collection(firestore, 'players', playerId, 'games')
    const reference = doc(games)
    const savedState = persistedGameStateSchema.parse(state)
    const savedHistory = spawnHistorySchema.parse(history.slice(-7))
    const activeGames = await getDocsFromServer(query(games, where('status', '==', 'active')))
    await runTransaction(firestore, async (transaction) => {
      const profile = await transaction.get(player)
      const previousId: unknown = profile.data()?.activeGameId
      if (previousId != null && (typeof previousId !== 'string' || !previousId || previousId.includes('/'))) {
        throw new Error('Invalid active game reference.')
      }
      const previous = new Map(activeGames.docs.map(entry => [entry.ref.path, entry.ref]))
      if (typeof previousId === 'string') {
        const previousRef = doc(games, previousId)
        previous.set(previousRef.path, previousRef)
      }
      const snapshots = await Promise.all([...previous.values()].map(ref => transaction.get(ref)))
      for (const old of snapshots) {
        if (old.exists() && old.data().status === 'active') {
          transaction.update(old.ref, { status: 'aborted', endTime: Date.now() })
        }
      }
      transaction.set(reference, {
        username: savedUsername.value,
        startTime: Date.now(),
        endTime: null,
        turn: 0,
        score: 0,
        highScore: 0,
        status: 'active',
        initialSeed,
        configId: config.id,
        state: savedState,
        spawnHistory: savedHistory,
        step: 0,
      })
      transaction.update(player, { activeGameId: reference.id })
    })
    session = { reference, step: 0, highScore: 0, ended: false }
  }

  function record(action: GameAction, state: GameState, history: SpawnEntry[]) {
    if (!saveGames || !database || !playerId || !session || session.ended || writeFailure) return
    const firestore = database
    const current = session
    const player = doc(firestore, 'players', playerId)
    const savedState = persistedGameStateSchema.parse(state)
    const savedHistory = spawnHistorySchema.parse(history.slice(-7))
    const savedAction: GameAction = action.type === 'move'
      ? { ...action }
      : { ...action, targets: action.targets.map(target => ({ ...target })) }
    const sequence = ++current.step
    current.highScore = Math.max(current.highScore, state.score)
    const highScore = current.highScore
    current.ended = state.gameOver
    pendingWrites.value++
    writeQueue = writeQueue.then(async () => {
      if (writeFailure) return
      await runTransaction(firestore, async (transaction) => {
        const [profile, game] = await Promise.all([
          transaction.get(player),
          transaction.get(current.reference),
        ])
        if (profile.data()?.activeGameId !== current.reference.id || !game.exists()
          || game.data().status !== 'active' || game.data().step !== sequence - 1) {
          throw new Error('This game was changed in another session.')
        }
        transaction.set(doc(current.reference, 'steps', String(sequence).padStart(10, '0')), {
          ...savedAction,
          sequence,
          time: Date.now(),
          turn: savedState.turn,
          score: savedState.score,
        })
        transaction.update(current.reference, {
          username: savedUsername.value,
          turn: savedState.turn,
          score: savedState.score,
          highScore,
          step: sequence,
          state: savedState,
          spawnHistory: savedHistory,
          config: deleteField(),
          configName: deleteField(),
          ...(savedState.gameOver ? { endTime: Date.now(), status: 'game-over' } : {}),
        })
        if (savedState.gameOver) transaction.update(player, { activeGameId: null })
      })
    }).catch((cause: unknown) => {
      writeFailure = cause
      console.error('A game save failed.', cause)
      saveError.value = 'A game save failed. Return to the menu and resume the last saved state.'
    }).finally(() => {
      pendingWrites.value--
    })
  }

  async function end() {
    await writeQueue
    if (writeFailure) throw new Error('Could not save the game.', { cause: writeFailure })
  }

  return {
    username,
    hasUnsavedUsername: computed(() => username.value !== savedUsername.value),
    ready,
    loading,
    error: computed(() => saveError.value || error.value),
    pendingWrites,
    connect,
    saveUsername,
    loadHistory,
    loadConfigs,
    loadConfig,
    loadActiveGame,
    begin,
    record,
    end,
  }
}
