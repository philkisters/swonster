import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/initialState'
import { useGameTracking } from '../app/composables/useGameTracking'

const firebase = vi.hoisted(() => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  commit: vi.fn(),
  signIn: vi.fn(),
}))

vi.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({}),
}))

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ authStateReady: async () => {}, currentUser: null }),
  signInAnonymously: firebase.signIn,
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  doc: (parent: { path?: string }, ...parts: string[]) => ({
    path: [parent.path, ...parts, ...(parts.length ? [] : ['new-game'])]
      .filter(Boolean)
      .join('/'),
  }),
  getDoc: firebase.getDoc,
  setDoc: firebase.setDoc,
  updateDoc: firebase.updateDoc,
  writeBatch: () => ({
    set: firebase.batchSet,
    update: firebase.batchUpdate,
    commit: firebase.commit,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ref', (value: unknown) => ({ value }))
  vi.stubGlobal('computed', (get: () => unknown) => ({ get value() { return get() } }))
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: {
      firebaseApiKey: 'key',
      firebaseAuthDomain: 'example',
      firebaseProjectId: 'project',
      firebaseAppId: 'app',
    },
  }))
  firebase.signIn.mockResolvedValue({ user: { uid: 'abcde12345' } })
  firebase.getDoc.mockResolvedValue({ exists: () => false })
  firebase.setDoc.mockResolvedValue(undefined)
  firebase.updateDoc.mockResolvedValue(undefined)
  firebase.commit.mockResolvedValue(undefined)
})

describe('game tracking', () => {
  it('creates a player and records ordered actions and final metrics', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    expect(tracking.username.value).toBe('anonymous-swonster#abcde')
    expect(firebase.setDoc).toHaveBeenCalledWith(
      { path: 'players/abcde12345' },
      { username: 'anonymous-swonster#abcde' },
    )
    expect(tracking.begin()).toBe(true)
    const state = createInitialState(42)
    tracking.record(
      { type: 'move', direction: 'left' },
      { ...state, turn: 1, score: 12 },
    )
    tracking.record(
      {
        type: 'spell',
        slot: 1,
        spellId: 'heal',
        targets: [{ shape: 'cell', index: 2 }],
      },
      { ...state, turn: 1, score: 9, gameOver: true },
    )
    expect(firebase.batchSet.mock.calls[0]).toMatchObject([
      { path: 'players/abcde12345/games/new-game/steps/0000000001' },
      { type: 'move', direction: 'left', sequence: 1, turn: 1, score: 12 },
    ])
    expect(firebase.batchSet.mock.calls[1]).toMatchObject([
      { path: 'players/abcde12345/games/new-game/steps/0000000002' },
      {
        type: 'spell',
        slot: 1,
        spellId: 'heal',
        targets: [{ shape: 'cell', index: 2 }],
        sequence: 2,
      },
    ])
    expect(firebase.batchUpdate.mock.calls[1][1]).toMatchObject({
      turn: 1,
      score: 9,
      highScore: 12,
      status: 'game-over',
      endTime: expect.any(Number),
    })
    tracking.end()
    expect(firebase.updateDoc).not.toHaveBeenCalled()
  })

  it('marks unfinished games abandoned and does not record without a player', async () => {
    const tracking = useGameTracking()
    expect(tracking.begin()).toBe(false)
    tracking.record({ type: 'move', direction: 'up' }, createInitialState(42))
    expect(firebase.batchSet).not.toHaveBeenCalled()
    await tracking.connect()
    tracking.begin()
    tracking.end()
    expect(firebase.updateDoc).toHaveBeenCalledWith(
      { path: 'players/abcde12345/games/new-game' },
      { endTime: expect.any(Number), status: 'abandoned' },
    )
  })

  it('tracks username changes until they are saved', async () => {
    const tracking = useGameTracking()
    await tracking.connect()

    expect(tracking.hasUnsavedUsername.value).toBe(false)
    tracking.username.value = 'New name'
    expect(tracking.hasUnsavedUsername.value).toBe(true)

    await tracking.saveUsername(tracking.username.value)

    expect(tracking.hasUnsavedUsername.value).toBe(false)
    expect(firebase.updateDoc).toHaveBeenCalledWith(
      { path: 'players/abcde12345' },
      { username: 'New name' },
    )
  })

  it('reports failed game writes', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tracking = useGameTracking()
    await tracking.connect()
    firebase.commit.mockRejectedValueOnce(new Error('permission denied'))
    tracking.begin()
    tracking.record({ type: 'move', direction: 'up' }, createInitialState(42))
    await vi.waitFor(() =>
      expect(tracking.error.value).toContain('game save failed'),
    )
    await tracking.saveUsername('New name')
    expect(tracking.error.value).toContain('game save failed')
    log.mockRestore()
  })
})
