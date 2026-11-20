import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../game/initialState'
import { DEFAULT_GAME_CONFIG } from '../game/config'
import { executeTurn } from '../game/engine'
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
  getDocsFromServer: vi.fn(),
  documents: new Map<string, Record<string, unknown>>(),
  nextId: 0,
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
    path: [parent.path, ...parts, ...(parts.length ? [] : [++firebase.nextId === 1 ? 'new-game' : `new-game-${firebase.nextId}`])]
      .filter(Boolean)
      .join('/'),
    get id() { return this.path.split('/').at(-1) },
  }),
  getDoc: firebase.getDoc,
  getDocFromServer: firebase.getDocFromServer,
  getDocs: firebase.getDocs,
  getDocsFromServer: firebase.getDocsFromServer,
  setDoc: firebase.setDoc,
  updateDoc: firebase.updateDoc,
  query: (source: unknown, ...constraints: unknown[]) => ({
    source,
    constraints,
  }),
  where: (...values: unknown[]) => ({ type: 'where', values }),
  orderBy: (...values: unknown[]) => ({ type: 'orderBy', values }),
  limit: (value: number) => ({ type: 'limit', value }),
  runTransaction: async (_database: unknown, callback: (transaction: unknown) => Promise<void>) => {
    const writes: Array<() => void> = []
    const snapshot = (ref: { path: string }) => ({
      ref,
      exists: () => firebase.documents.has(ref.path),
      data: () => firebase.documents.get(ref.path),
    })
    await callback({
      get: async (ref: { path: string }) => snapshot(ref),
      set: (ref: { path: string }, value: Record<string, unknown>) => {
        firebase.batchSet(ref, value)
        writes.push(() => firebase.documents.set(ref.path, value))
      },
      update: (ref: { path: string }, value: Record<string, unknown>) => {
        firebase.batchUpdate(ref, value)
        writes.push(() => firebase.documents.set(ref.path, { ...firebase.documents.get(ref.path), ...value }))
      },
    })
    await firebase.commit()
    writes.forEach(write => write())
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  firebase.documents.clear()
  firebase.nextId = 0
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
  firebase.getDoc.mockImplementation(async (ref) => ({
    exists: () => firebase.documents.has(ref.path),
    data: () => firebase.documents.get(ref.path),
  }))
  firebase.setDoc.mockImplementation(async (ref, data) => {
    firebase.documents.set(ref.path, { ...firebase.documents.get(ref.path), ...data })
  })
  firebase.updateDoc.mockResolvedValue(undefined)
  firebase.getDocFromServer.mockImplementation(async (ref) => ({
    ref,
    exists: () => firebase.documents.has(ref.path),
    data: () => firebase.documents.get(ref.path),
  }))
  firebase.getDocsFromServer.mockImplementation(async (source) => ({
    docs: [...firebase.documents.entries()]
      .filter(([path, data]) => path.startsWith(`${source.source.path}/`) && data.status === 'active')
      .map(([path]) => ({ ref: { path, id: path.split('/').at(-1) } })),
  }))
  firebase.commit.mockResolvedValue(undefined)
  firebase.getDocs.mockResolvedValue({ docs: [] })
})

describe('game tracking', () => {
  const config = { id: 'daily-1', name: 'Daily', rules: DEFAULT_GAME_CONFIG }
  const history = [{ kind: 'friend' as const, typeId: 'dragon', tier: 1 }]
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
    await tracking.begin(42, selected, createInitialState(42), history)
    expect(firebase.batchSet).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'players/abcde12345/games/new-game' }),
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
      expect.objectContaining({ path: 'players/abcde12345' }),
      { username: 'anonymous-swonster#abcde' },
      { merge: true },
    )
    const state = createInitialState(42)
    await tracking.begin(42, config, state, history)
    firebase.batchSet.mockClear()
    firebase.batchUpdate.mockClear()
    tracking.record(
      { type: 'move', direction: 'left' },
      { ...state, turn: 1, score: 12 },
      history,
    )
    tracking.record(
      {
        type: 'spell',
        slot: 1,
        spellId: 'heal',
        targets: [{ shape: 'cell', index: 2 }],
      },
      { ...state, turn: 1, score: 9, gameOver: true },
      history,
    )
    await tracking.end()
    expect(firebase.batchSet.mock.calls[0]).toMatchObject([
      expect.objectContaining({ path: 'players/abcde12345/games/new-game/steps/0000000001' }),
      { type: 'move', direction: 'left', sequence: 1, turn: 1, score: 12 },
    ])
    expect(firebase.batchSet.mock.calls[1]).toMatchObject([
      expect.objectContaining({ path: 'players/abcde12345/games/new-game/steps/0000000002' }),
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
    expect(firebase.updateDoc).not.toHaveBeenCalled()
  })

  it('keeps an unfinished game active on exit and restores its latest state and step', async () => {
    const tracking = useGameTracking()
    await expect(tracking.begin(42, config, createInitialState(42), history)).rejects.toThrow('Connect')
    tracking.record({ type: 'move', direction: 'up' }, createInitialState(42), history)
    expect(firebase.batchSet).not.toHaveBeenCalled()
    await tracking.connect()
    await tracking.begin(42, config, createInitialState(42), history)
    await expect(tracking.loadActiveGame()).resolves.toMatchObject({
      state: createInitialState(42), history,
    })
    const state = { ...createInitialState(42), turn: 3, score: 15 }
    tracking.record({ type: 'move', direction: 'up' }, state, history)
    await tracking.end()
    expect(firebase.documents.get('players/abcde12345/games/new-game')?.status).toBe('active')
    const resumed = useGameTracking()
    await resumed.connect()
    const saved = await resumed.loadActiveGame()
    expect(saved).toMatchObject({ state, history, config })
    expect(executeTurn(saved!.state, 'left')).toEqual(executeTurn(state, 'left'))
    resumed.record({ type: 'move', direction: 'left' }, { ...state, turn: 4 }, history)
    await resumed.end()
    expect(firebase.documents.has('players/abcde12345/games/new-game/steps/0000000002')).toBe(true)
  })

  it('aborts all previous active games, including legacy games, when starting a new one', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    await tracking.begin(42, config, createInitialState(42), history)
    firebase.documents.set('players/abcde12345/games/legacy', { status: 'active' })
    await tracking.begin(43, config, createInitialState(43), history)
    expect(firebase.documents.get('players/abcde12345/games/new-game')).toMatchObject({
      status: 'aborted', endTime: expect.any(Number),
    })
    expect(firebase.documents.get('players/abcde12345/games/legacy')?.status).toBe('aborted')
    expect(firebase.documents.get('players/abcde12345/games/new-game-2')?.status).toBe('active')
    expect(firebase.documents.get('players/abcde12345')?.activeGameId).toBe('new-game-2')
  })

  it('leaves the previous game active if starting a replacement fails', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    await tracking.begin(42, config, createInitialState(42), history)
    firebase.commit.mockRejectedValueOnce(new Error('permission denied'))
    await expect(tracking.begin(43, config, createInitialState(43), history)).rejects.toThrow('permission denied')
    expect(firebase.documents.get('players/abcde12345/games/new-game')?.status).toBe('active')
    expect(firebase.documents.get('players/abcde12345')?.activeGameId).toBe('new-game')
    expect(firebase.documents.has('players/abcde12345/games/new-game-2')).toBe(false)
  })

  it('reports an invalid saved state instead of resuming it', async () => {
    const tracking = useGameTracking()
    await tracking.connect()
    await tracking.begin(42, config, createInitialState(42), history)
    const game = firebase.documents.get('players/abcde12345/games/new-game')!
    firebase.documents.set('players/abcde12345/games/new-game', { ...game, state: { cells: [] } })
    await expect(tracking.loadActiveGame()).rejects.toThrow()
  })

  it('rejects stale sessions instead of overwriting newer progress or reviving an aborted game', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = useGameTracking()
    await first.connect()
    await first.begin(42, config, createInitialState(42), history)
    const second = useGameTracking()
    await second.connect()
    await second.loadActiveGame()
    first.record({ type: 'move', direction: 'up' }, { ...createInitialState(42), turn: 1 }, history)
    await first.end()
    second.record({ type: 'move', direction: 'left' }, { ...createInitialState(42), turn: 1 }, history)
    await expect(second.end()).rejects.toThrow('Could not save')
    expect(firebase.documents.get('players/abcde12345/games/new-game/steps/0000000001')).toMatchObject({
      direction: 'up',
    })
    await first.begin(43, config, createInitialState(43), history)
    first.record({ type: 'move', direction: 'left' }, { ...createInitialState(43), gameOver: true }, history)
    await first.end()
    expect(firebase.documents.get('players/abcde12345')?.activeGameId).toBeNull()
    await expect(first.loadActiveGame()).resolves.toBeNull()
    log.mockRestore()
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
      expect.objectContaining({ path: 'players/abcde12345' }),
      { username: 'New name' },
    )
  })

  it('reports failed game writes', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tracking = useGameTracking()
    await tracking.connect()
    await tracking.begin(42, config, createInitialState(42), history)
    firebase.commit.mockRejectedValueOnce(new Error('permission denied'))
    tracking.record({ type: 'move', direction: 'up' }, createInitialState(42), history)
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
