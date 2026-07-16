import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProxyAgent, fetch as undiciFetch } from 'undici'

import { proxyWereadRequest } from './weread-proxy'

vi.mock('undici', () => ({
  ProxyAgent: vi.fn(),
  fetch: vi.fn(),
}))

function request(body: string, apiKey = 'wrk-secret') {
  return new Request('http://localhost/api/weread', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })
}

describe('proxyWereadRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('forwards an allowed request and preserves the upstream response', async () => {
    const upstream = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ books: [] }), {
          headers: { 'Content-Type': 'application/json;charset=utf-8' },
        }),
      ),
    )
    vi.mocked(undiciFetch).mockImplementation(upstream)

    const response = await proxyWereadRequest(
      request(
        JSON.stringify({
          api_name: '/user/notebooks',
          count: 100,
          skill_version: '1.0.4',
        }),
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ books: [] })
    expect(upstream).toHaveBeenCalledWith(
      'https://i.weread.qq.com/api/agent/gateway',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrk-secret',
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('reuses one proxy dispatcher across requests', async () => {
    vi.mocked(undiciFetch).mockImplementation(() =>
      Promise.resolve(
        new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const allowedRequest = () =>
      request(JSON.stringify({ api_name: '/user/notebooks' }))

    await proxyWereadRequest(allowedRequest())
    await proxyWereadRequest(allowedRequest())

    expect(ProxyAgent).toHaveBeenCalledTimes(
      (process.env.HTTPS_PROXY ?? process.env.https_proxy) ? 1 : 0,
    )
  })

  it('returns a stable gateway error when the upstream is unreachable', async () => {
    vi.mocked(undiciFetch).mockRejectedValueOnce(new Error('ECONNRESET'))

    const response = await proxyWereadRequest(
      request(JSON.stringify({ api_name: '/user/notebooks' })),
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      errmsg: '无法连接微信读书服务，请稍后重试',
    })
  })

  it('returns a gateway timeout when the upstream exceeds its deadline', async () => {
    const error = new Error('timed out')
    error.name = 'TimeoutError'
    vi.mocked(undiciFetch).mockRejectedValueOnce(error)

    const response = await proxyWereadRequest(
      request(JSON.stringify({ api_name: '/user/notebooks' })),
    )

    expect(response.status).toBe(504)
    await expect(response.json()).resolves.toEqual({
      errmsg: '连接微信读书服务超时，请重试',
    })
  })

  it.each(['missing', 'Bearer token', 'Bearer wrk-'])(
    'rejects invalid authorization: %s',
    async (authorization) => {
      const headers =
        authorization === 'missing' ? {} : { Authorization: authorization }
      const response = await proxyWereadRequest(
        new Request('http://localhost/api/weread', {
          method: 'POST',
          headers,
          body: JSON.stringify({ api_name: '/user/notebooks' }),
        }),
      )

      expect(response.status).toBe(401)
    },
  )

  it('rejects malformed JSON', async () => {
    const response = await proxyWereadRequest(request('{invalid'))
    expect(response.status).toBe(400)
  })

  it('prevents use as an open API proxy', async () => {
    const response = await proxyWereadRequest(
      request(JSON.stringify({ api_name: '/store/search' })),
    )
    expect(response.status).toBe(403)
  })

  it('uses the platform fetch when no outbound proxy is configured', async () => {
    vi.resetModules()
    vi.mocked(undiciFetch).mockClear()
    vi.stubEnv('HTTPS_PROXY', '')
    vi.stubEnv('https_proxy', '')
    const platformFetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ books: [] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', platformFetch)
    const { proxyWereadRequest: proxyWithoutDispatcher } =
      await import('./weread-proxy')

    const response = await proxyWithoutDispatcher(
      request(JSON.stringify({ api_name: '/user/notebooks' })),
    )

    expect(response.status).toBe(200)
    expect(platformFetch).toHaveBeenCalledOnce()
    expect(undiciFetch).not.toHaveBeenCalled()
  })
})
