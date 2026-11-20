import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/initialState'
import { DEFAULT_GAME_CONFIG } from '../game/config'
import { ArchivedConfigError, useGameTracking } from '../app/composables/useGameTracking'

const firebase = vi.hoisted(() => ({
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  commit: vi.fn(),
  signIn: vi.fn(),
  getDocs: vi.fn(),
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
  collectionGroup: (_db: unknown, name: string) => ({ path: name }),
  doc: (parent: { path?: string }, ...parts: string[]) => ({
    path: [parent.path, ...parts, ...(parts.length ? [] : ['new-game'])]
      .filter(Boolean)
      .join('/'),
  }),
  getDoc: firebase.getDoc,
  getDocFromServer: firebase.getDocFromServer,
  getDocs: firebase.getDocs,
  setDoc: firebase.setDoc,
  updateDoc: firebase.updateDoc,
  query: (source: unknown, ...constraints: unknown[]) => ({
    source,
    constraints,
  }),
  where: (...values: unknown[]) => ({ type: 'where', values }),
  orderBy: (...values: unknown[]) => ({ type: 'orderBy', values }),
  limit: (value: number) => ({ type: 'limit', value }),
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
  firebase.getDocs.mockResolvedValue({ docs: [] })
})

describe('game tracking', () => {
  it('loads published configurations and snapshots the selected rules with each game', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    firebase.getDocs.mockResolvedValueOnce({
      docs: [{ id: 'daily-1', data: () => ({ name: 'Daily', rules: DEFAULT_GAME_CONFIG }) }],
    })
    const configs = await tracking.loadConfigs()
    expect(configs).toEqual([{ id: 'daily-1', name: 'Daily', rules: DEFAULT_GAME_CONFIG }])
    firebase.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: 'Daily', rules: DEFAULT_GAME_CONFIG }),
    })
    const selected = await tracking.loadConfig('daily-1')
    tracking.begin(42, selected)
    expect(firebase.setDoc).toHaveBeenLastCalledWith(
      { path: 'players/abcde12345/games/new-game' },
      expect.objectContaining({
        configId: 'daily-1', configName: 'Daily', config: DEFAULT_GAME_CONFIG, initialSeed: 42
      }),
    )
  })

  it('keeps archived configurations in history lists but rejects them for new games', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    firebase.getDocs.mockResolvedValue({
      docs: [
        { id: 'legacy', data: () => ({ name: 'Legacy', rules: DEFAULT_GAME_CONFIG }) },
        { id: 'archived', data: () => ({ name: 'Archived', rules: DEFAULT_GAME_CONFIG, archived: true }) },
        { id: 'restored', data: () => ({ name: 'Restored', rules: DEFAULT_GAME_CONFIG, archived: false }) },
      ],
    })
    expect((await tracking.loadConfigs()).map(config => config.id)).toEqual(['legacy', 'restored'])
    expect((await tracking.loadConfigs(true)).find(config => config.id === 'archived')?.archived).toBe(true)
    firebase.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: 'Archived', rules: DEFAULT_GAME_CONFIG, archived: true }),
    })
    await expect(tracking.loadConfig('archived')).rejects.toBeInstanceOf(ArchivedConfigError)
    firebase.getDocFromServer.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: 'Restored', rules: DEFAULT_GAME_CONFIG, archived: false }),
    })
    await expect(tracking.loadConfig('restored')).resolves.toMatchObject({ id: 'restored', archived: false })
  })

  it('filters high scores by configuration and keeps older games separate', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    firebase.getDocs.mockResolvedValue({
      docs: [
        { id: 'old', data: () => ({ status: 'game-over', highScore: 10, username: 'Player' }) },
        { id: 'new', data: () => ({ status: 'game-over', highScore: 100, configId: 'daily-1', username: 'Player' }) },
      ],
    })
    await tracking.loadHistory('best-global', 'daily-1')
    expect(firebase.getDocs.mock.calls[0][0]).toMatchObject({
      constraints: [
        { type: 'where', values: ['configId', '==', 'daily-1'] },
        { type: 'where', values: ['status', '==', 'game-over'] },
        { type: 'orderBy', values: ['highScore', 'desc'] },
        { type: 'limit', value: 10 },
      ],
    })
    expect((await tracking.loadHistory('best-personal', '__legacy__')).map(game => game.id)).toEqual(['old'])
  })

  it('creates a player and records ordered actions and final metrics', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    expect(tracking.username.value).toBe('anonymous-swonster#abcde')
    expect(firebase.setDoc).toHaveBeenCalledWith(
      { path: 'players/abcde12345' },
      { username: 'anonymous-swonster#abcde' },
    )
    expect(tracking.begin(42)).toBe(true)
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
      username: 'anonymous-swonster#abcde',
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
    expect(tracking.begin(42)).toBe(false)
    tracking.record({ type: 'move', direction: 'up' }, createInitialState(42))
    expect(firebase.batchSet).not.toHaveBeenCalled()
    await tracking.connect()
    tracking.begin(42)
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
    tracking.begin(42)
    tracking.record({ type: 'move', direction: 'up' }, createInitialState(42))
    await vi.waitFor(() =>
      expect(tracking.error.value).toContain('game save failed'),
    )
    await tracking.saveUsername('New name')
    expect(tracking.error.value).toContain('game save failed')
    log.mockRestore()
  })

  it('loads the latest ten games and the ten best finished games', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    firebase.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'latest',
          data: () => ({
            startTime: 20,
            endTime: null,
            turn: 4,
            highScore: 12,
            status: 'active',
          }),
        },
      ],
    })

    await expect(tracking.loadHistory('latest')).resolves.toEqual([
      {
        id: 'latest',
        startTime: 20,
        endTime: null,
        turn: 4,
        highScore: 12,
        status: 'active',
      },
    ])
    expect(firebase.getDocs.mock.calls[0][0]).toMatchObject({
      source: { path: 'players/abcde12345/games' },
      constraints: [
        { type: 'orderBy', values: ['startTime', 'desc'] },
        { type: 'limit', value: 10 },
      ],
    })

    firebase.getDocs.mockResolvedValueOnce({
      docs: Array.from({ length: 12 }, (_, index) => ({
        id: `game-${index}`,
        data: () => ({
          startTime: index,
          endTime: index + 100,
          turn: index + 1,
          highScore: index,
          status: 'game-over',
        }),
      })),
    })

    const best = await tracking.loadHistory('best-personal')
    expect(best).toHaveLength(10)
    expect(best[0]?.id).toBe('game-11')
    expect(best[9]?.id).toBe('game-2')
    expect(firebase.getDocs.mock.calls[1][0]).toMatchObject({
      constraints: [
        { type: 'where', values: ['status', '==', 'game-over'] },
        { type: 'orderBy', values: ['highScore', 'desc'] },
        { type: 'limit', value: 10 },
      ],
    })
  })

  it('loads the global top ten with usernames', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    firebase.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'global-game',
          data: () => ({
            username: 'Champion',
            startTime: 10,
            endTime: 100,
            turn: 20,
            highScore: 500,
            status: 'game-over',
          }),
        },
      ],
    })

    await expect(tracking.loadHistory('best-global')).resolves.toEqual([
      {
        id: 'global-game',
        username: 'Champion',
        startTime: 10,
        endTime: 100,
        turn: 20,
        highScore: 500,
        status: 'game-over',
      },
    ])
    expect(firebase.getDocs.mock.calls[0][0]).toMatchObject({
      source: { path: 'games' },
      constraints: [
        { type: 'where', values: ['status', '==', 'game-over'] },
        { type: 'orderBy', values: ['highScore', 'desc'] },
        { type: 'limit', value: 10 },
      ],
    })
  })
})
