import { afterEach, describe, expect, test, vi } from 'vitest'
import { RoteClient, normalizeInstanceUrl } from './rote-client'
import type { InstanceInfo } from './types'

const info: InstanceInfo = {
  protocolVersion: 1,
  owner: { id: 'owner', username: 'owner', nickname: null },
  permissions: ['SENDROTE', 'GETROTE'],
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
}
afterEach(() => vi.unstubAllGlobals())
describe('instance connection contract', () => {
  test('normalizes API URLs and rejects URL credentials, query strings and unsupported protocols', () => {
    expect(
      normalizeInstanceUrl(' https://example.test/rote/v2/api/openkey/ '),
    ).toBe('https://example.test/rote')
    for (const url of [
      'ftp://example.test',
      'https://user:pass@example.test',
      'https://example.test?key=secret',
      'https://example.test/#secret',
    ]) {
      expect(() => normalizeInstanceUrl(url)).toThrow('invalid_instance_url')
    }
  })
  test('sends the in-memory credential only in a header, without cookies or redirects', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 0, data: info })))
    vi.stubGlobal('fetch', fetch)
    const client = await RoteClient.connect(
      'https://example.test',
      'fixture-secret',
      new AbortController().signal,
    )
    expect(client.info.owner.id).toBe('owner')
    expect(fetch).toHaveBeenCalledWith(
      'https://example.test/v2/api/openkey/imports/connect',
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        body: '{}',
        headers: {
          Authorization: 'Bearer fixture-secret',
          'Content-Type': 'application/json',
        },
      }),
    )
  })
  test('reports old instances, malformed capabilities and blocked CORS explicitly', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    const connect = () =>
      RoteClient.connect(
        'https://example.test',
        'fixture-secret',
        new AbortController().signal,
      )
    await expect(connect()).rejects.toThrow('instance_upgrade_required')
    fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            ...info,
            capabilities: { ...info.capabilities, maxAttachments: undefined },
          },
        }),
      ),
    )
    await expect(connect()).rejects.toThrow('instance_upgrade_required')
    fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(connect()).rejects.toThrow('network_or_cors')
  })
  test('redacts a credential echoed by an instance error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: 1, message: 'fixture-secret is invalid' }),
            { status: 401 },
          ),
        ),
    )
    await expect(
      RoteClient.connect(
        'https://example.test',
        'fixture-secret',
        new AbortController().signal,
      ),
    ).rejects.toThrow('[redacted] is invalid')
  })
})
