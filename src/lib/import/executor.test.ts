import { afterEach, describe, expect, test, vi } from 'vitest'
import { createImportSource } from '../converters/import-source'
import { executeImport } from './executor'
import type { RoteNote } from '../converters/types'
import type { ExecuteImportOptions } from './executor'
import type { ImportApi, ImportPayload, PreparedMedia } from './types'

vi.mock('./media', () => ({
  prepareMedia: async (blob: Blob): Promise<PreparedMedia> => ({
    original: new Blob([blob], { type: 'image/png' }),
    preview: new Blob(['RIFFxxxxWEBPbytes'], { type: 'image/webp' }),
    width: 10,
    height: 10,
    hash: 'test-hash',
    kind: 'image',
  }),
}))
afterEach(() => vi.unstubAllGlobals())

function note(index: number, attachments = 0): RoteNote {
  return {
    id: String(index),
    title: '',
    type: 'Rote',
    tags: [],
    content: `Note ${index}`,
    state: 'public',
    archived: false,
    authorid: '',
    articleId: null,
    pin: false,
    editor: 'normal',
    createdAt: '2020-01-01T00:00:00.000Z',
    author: { username: 'test', nickname: 'test', avatar: null },
    reactions: [],
    source: createImportSource({
      provider: 'dinox',
      accountKey: 'account',
      externalKey: String(index),
    }),
    attachments: Array.from({ length: attachments }, (_, sortIndex) => ({
      id: `${index}-${sortIndex}`,
      url: `https://source.test/${index}/${sortIndex}`,
      compressUrl: '',
      userid: '',
      roteid: '',
      storage: 'REMOTE',
      details: {
        key: '',
        compressKey: '',
        mimetype: 'image/png',
        size: 0,
        mtime: '',
      },
      createdAt: '',
      updatedAt: '',
      sortIndex,
    })),
  }
}
function harness(notes: Array<RoteNote>) {
  const events: Array<string> = []
  let attachmentId = 0
  const api: ImportApi = {
    info: {
      protocolVersion: 1,
      owner: { id: 'test', username: 'test', nickname: null },
      permissions: [],
      capabilities: {
        formalImport: 2,
        sourceIdentity: true,
        historicalCreatedAt: true,
        bindUnboundAttachments: true,
        batchSize: 50,
        attachments: true,
        video: false,
        overwrite: false,
        articles: false,
        cleanupUnbound: true,
        browserDirectUpload: true,
        imageMimeTypes: ['image/png'],
        videoMimeTypes: [],
        maxImageBytes: 20000000,
        maxVideoBytes: 300000000,
        maxAttachments: 9,
      },
    },
    plan: vi.fn(async (payload: ImportPayload) => {
      events.push(`plan:${payload.notes.length}`)
      return { noteIndexes: payload.notes.map((_, index) => index) }
    }),
    commit: vi.fn(async (payload: ImportPayload) => {
      events.push(`commit:${payload.notes.length}`)
      return {
        results: payload.notes.map((_, index) => ({
          index,
          id: `target-${index}`,
          status: 'created' as const,
        })),
      }
    }),
    presign: vi.fn(async () => {
      events.push('presign')
      return {
        reservationId: `reservation-${attachmentId}`,
        items: [
          {
            uuid: 'uuid',
            original: {
              key: 'original',
              putUrl: 'https://storage.test/original',
              contentType: 'image/png',
            },
            compressed: {
              key: 'preview',
              putUrl: 'https://storage.test/preview',
              contentType: 'image/webp',
            },
          },
        ],
      }
    }),
    finalize: vi.fn(async () => {
      events.push('finalize')
      return [
        {
          ...note(0, 1).attachments[0],
          id: `attachment-${attachmentId++}`,
          compressUrl: 'https://storage.test/preview',
          storage: 'R2',
        },
      ]
    }),
    cleanup: vi.fn(async () => {
      events.push('cleanup')
    }),
    cancelReservation: vi.fn(async () => {
      events.push('cancel-reservation')
    }),
  }
  const controller = new AbortController()
  const options: ExecuteImportOptions = {
    api,
    data: { formatVersion: 2, notes, articles: [] },
    selectedIds: new Set(notes.map((item) => item.id)),
    existingStrategy: 'skip',
    preserveVisibility: false,
    signal: controller.signal,
    resources: new Map(),
    onProgress: vi.fn(),
    onResult: vi.fn(),
  }
  const fetch = vi.fn(
    async (_url: string | URL | Request, init?: RequestInit) => {
      events.push(init?.method === 'PUT' ? 'put' : 'download')
      return new Response(init?.method === 'PUT' ? null : 'original bytes', {
        status: 200,
      })
    },
  )
  vi.stubGlobal('fetch', fetch)
  return { api, controller, options, events, fetch }
}

describe('formal import executor', () => {
  test('plans everything before downloads, skips known sources and submits at most 50', async () => {
    const run = harness(Array.from({ length: 103 }, (_, index) => note(index)))
    await executeImport(run.options)
    expect(run.events.slice(0, 3)).toEqual(['plan:50', 'plan:50', 'plan:3'])
    expect(run.events.filter((event) => event.startsWith('commit'))).toEqual([
      'commit:50',
      'commit:50',
      'commit:3',
    ])
    expect(run.api.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        importOptions: {
          existingStrategy: 'skip',
          visibilityStrategy: 'private',
        },
      }),
      expect.any(AbortSignal),
    )
    const skipped = harness([note(1, 1)])
    vi.mocked(skipped.api.plan).mockResolvedValue({ noteIndexes: [] })
    await executeImport(skipped.options)
    expect(skipped.fetch).not.toHaveBeenCalled()
    expect(skipped.options.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' }),
    )
  })
  test('plan → presign → PUT original/preview → finalize → import preserves order and dates', async () => {
    const run = harness([note(1, 2)])
    await executeImport(run.options)
    expect(run.events.slice(0, 9)).toEqual([
      'plan:1',
      'download',
      'presign',
      'put',
      'put',
      'finalize',
      'download',
      'presign',
      'put',
    ])
    const payload = vi.mocked(run.api.commit).mock.calls[0][0]
    expect(payload.notes[0].createdAt).toBe('2020-01-01T00:00:00.000Z')
    expect(
      payload.notes[0].attachments.map((attachment) => attachment.sortIndex),
    ).toEqual([0, 1])
    expect(run.options.resources.size).toBe(0)
  })
  test('partial attachment failure never submits a note and cleans finalized siblings; retry succeeds', async () => {
    const run = harness([note(1, 2)])
    run.fetch.mockImplementation(
      async (url, init) =>
        new Response(init?.method === 'PUT' ? null : 'bytes', {
          status: String(url).endsWith('/1/1') ? 500 : 200,
        }),
    )
    await executeImport(run.options)
    expect(run.api.commit).not.toHaveBeenCalled()
    expect(run.api.cleanup).toHaveBeenCalledWith(['attachment-0'])
    expect(run.options.onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        stage: 'download',
        attachmentIndex: 1,
      }),
    )
    run.fetch.mockImplementation(
      async (_url, init) =>
        new Response(init?.method === 'PUT' ? null : 'bytes'),
    )
    await executeImport(run.options)
    expect(run.api.commit).toHaveBeenCalledTimes(1)
  })
  test('cancel stops subsequent uploads and commit, and cleans all unbound attachments', async () => {
    const run = harness([note(1, 2), note(2, 1)])
    run.options.onProgress = (progress) => {
      if (progress.stage === 'finalize') run.controller.abort()
    }
    await expect(executeImport(run.options)).rejects.toThrow()
    expect(run.api.commit).not.toHaveBeenCalled()
    expect(run.options.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' }),
    )
    expect(run.api.cancelReservation).toHaveBeenCalled()
  })
  test('cleanup failure retains resources and blocks retry uploads until cleanup succeeds', async () => {
    const run = harness([note(1, 1)])
    run.options.resources.set('1', { ids: ['old-unbound'], reservations: [] })
    vi.mocked(run.api.cleanup).mockRejectedValue(new Error('offline'))
    await executeImport(run.options)
    expect(run.fetch).not.toHaveBeenCalled()
    expect(run.options.resources.size).toBe(1)
    expect(run.options.onResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', cleanupPending: true }),
    )
    vi.mocked(run.api.cleanup).mockResolvedValue(undefined)
    await executeImport(run.options)
    expect(run.api.commit).toHaveBeenCalledTimes(1)
  })
})
