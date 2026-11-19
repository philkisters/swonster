import { getApps, initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentReference, Firestore } from 'firebase/firestore'
import type { GameState } from '~~/game/types'
import type { GameAction } from './useGame'

interface Session {
  reference: DocumentReference
  step: number
  highScore: number
  ended: boolean
}

export function useGameTracking() {
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

  function observeWrite(write: Promise<void>) {
    pendingWrites.value++
    void write
      .catch((cause: unknown) => {
        console.error('A game save failed.', cause)
        saveError.value = 'A game save failed. Your game data may be incomplete.'
      })
      .finally(() => {
        pendingWrites.value--
      })
  }

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
        await setDoc(player, { username: name })
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

  function begin() {
    session = undefined
    if (!database || !playerId || !ready.value) return false
    const reference = doc(collection(database, 'players', playerId, 'games'))
    session = { reference, step: 0, highScore: 0, ended: false }
    observeWrite(
      setDoc(reference, {
        startTime: Date.now(),
        endTime: null,
        turn: 0,
        score: 0,
        highScore: 0,
        status: 'active',
      }),
    )
    return true
  }

  function record(action: GameAction, state: GameState) {
    if (!database || !session || session.ended) return
    session.step++
    session.highScore = Math.max(session.highScore, state.score)
    session.ended = state.gameOver
    const batch = writeBatch(database)
    const step = doc(
      session.reference,
      'steps',
      String(session.step).padStart(10, '0'),
    )
    batch.set(step, {
      ...action,
      sequence: session.step,
      time: Date.now(),
      turn: state.turn,
      score: state.score,
    })
    batch.update(session.reference, {
      turn: state.turn,
      score: state.score,
      highScore: session.highScore,
      ...(state.gameOver ? { endTime: Date.now(), status: 'game-over' } : {}),
    })
    observeWrite(batch.commit())
  }

  function end() {
    if (!session || session.ended) return
    session.ended = true
    observeWrite(
      updateDoc(session.reference, {
        endTime: Date.now(),
        status: 'abandoned',
      }),
    )
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
    begin,
    record,
    end,
  }
}
