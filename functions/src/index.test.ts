import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GAME_CONFIG } from '../../game/config'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  doc: vi.fn(),
  onCall: vi.fn((_options: unknown, handler: (request: unknown) => Promise<unknown>) => handler)
}))

vi.mock('firebase-admin/app', () => ({ initializeApp: vi.fn() }))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({ collection: () => ({ doc: mocks.doc }) })
}))
vi.mock('firebase-functions/v2/https', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase-functions/v2/https')>(),
  onCall: mocks.onCall
}))

await import('./index')

const handler = mocks.onCall.mock.calls[0]![1]
const archiveHandler = mocks.onCall.mock.calls[1]![1]
const admin = { uid: 'admin', token: { admin: true, firebase: { sign_in_provider: 'google.com' } } }
const valid = { id: 'daily-1', name: 'Daily', rules: DEFAULT_GAME_CONFIG }

beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue(undefined)
  mocks.update.mockReset().mockResolvedValue(undefined)
  mocks.doc.mockReset().mockReturnValue({ create: mocks.create, update: mocks.update })
})

describe('admin config archiving', () => {
  it('requires a Google admin and validates the requested state', async () => {
    await expect(archiveHandler({ data: { id: 'daily-1', archived: true } }))
      .rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(archiveHandler({ auth: { ...admin, token: { ...admin.token, admin: false } }, data: { id: 'daily-1', archived: true } }))
      .rejects.toMatchObject({ code: 'permission-denied' })
    await expect(archiveHandler({ auth: admin, data: { id: 'daily-1', archived: 'true' } }))
      .rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(archiveHandler({ auth: admin, data: { id: '../bad', archived: true } }))
      .rejects.toMatchObject({ code: 'invalid-argument' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('archives and restores only the status field and fails for missing configs', async () => {
    await expect(archiveHandler({ auth: admin, data: { id: 'daily-1', archived: true } }))
      .resolves.toEqual({ id: 'daily-1', archived: true })
    expect(mocks.doc).toHaveBeenCalledWith('daily-1')
    expect(mocks.update).toHaveBeenCalledWith({ archived: true })
    await expect(archiveHandler({ auth: admin, data: { id: 'daily-1', archived: false } }))
      .resolves.toEqual({ id: 'daily-1', archived: false })
    expect(mocks.update).toHaveBeenLastCalledWith({ archived: false })
    mocks.update.mockRejectedValueOnce({ code: 5 })
    await expect(archiveHandler({ auth: admin, data: { id: 'missing', archived: true } }))
      .rejects.toMatchObject({ code: 'not-found' })
  })
})

describe('admin config publishing', () => {
  it('rejects unauthenticated, non-admin and anonymous requests', async () => {
    await expect(handler({ data: valid })).rejects.toMatchObject({ code: 'unauthenticated' })
    await expect(handler({ data: valid, auth: { ...admin, token: { ...admin.token, admin: false } } }))
      .rejects.toMatchObject({ code: 'permission-denied' })
    await expect(handler({ data: valid, auth: { ...admin, token: { ...admin.token, firebase: { sign_in_provider: 'anonymous' } } } }))
      .rejects.toMatchObject({ code: 'permission-denied' })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('validates input on the server before creating a document', async () => {
    await expect(handler({ auth: admin, data: { ...valid, id: '__legacy__' } }))
      .rejects.toMatchObject({ code: 'invalid-argument' })
    await expect(handler({ auth: admin, data: { ...valid, rules: { ...valid.rules, boardWidth: 3 } } }))
      .rejects.toMatchObject({ code: 'invalid-argument', message: expect.stringContaining('rules.boardWidth') })
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('creates new configs and refuses an existing ID', async () => {
    await expect(handler({ auth: admin, data: valid })).resolves.toEqual({ id: 'daily-1' })
    expect(mocks.doc).toHaveBeenCalledWith('daily-1')
    expect(mocks.create).toHaveBeenCalledWith({ name: 'Daily', rules: DEFAULT_GAME_CONFIG })
    mocks.create.mockRejectedValueOnce({ code: 6 })
    await expect(handler({ auth: admin, data: valid })).rejects.toMatchObject({ code: 'already-exists' })
  })
})
