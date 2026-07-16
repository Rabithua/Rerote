import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchWereadFromApi } from './weread-api'

interface RequestBody {
  api_name: string
  bookId?: string
  bookid?: string
  lastSort?: number
  synckey?: number
  skill_version: string
  params?: unknown
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? 'OK' : 'Unauthorized',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchWereadFromApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the official gateway, follows both cursors, and combines all books', async () => {
    const bodies: Array<RequestBody> = []
    const progress = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        await Promise.resolve()
        const body = JSON.parse(String(init?.body)) as RequestBody
        bodies.push(body)

        if (
          body.api_name === '/user/notebooks' &&
          body.lastSort === undefined
        ) {
          return jsonResponse({
            books: [
              { bookId: 'book-1', sort: 20, book: { title: '第一本书' } },
            ],
            hasMore: 1,
          })
        }
        if (body.api_name === '/user/notebooks') {
          return jsonResponse({
            books: [
              { bookId: 'book-2', sort: 10, book: { title: '第二本书' } },
            ],
            hasMore: 0,
          })
        }
        if (body.api_name === '/book/bookmarklist') {
          return jsonResponse({
            book: {
              bookId: body.bookId,
              title: body.bookId === 'book-1' ? '第一本书' : '第二本书',
            },
            chapters: [{ chapterUid: 3, title: '第三章' }],
            updated: [
              {
                bookmarkId: `${body.bookId}-mark`,
                chapterUid: 3,
                markText: `${body.bookId} 划线`,
                createTime: 1_700_000_000,
              },
            ],
          })
        }
        if (
          body.api_name === '/review/list/mine' &&
          body.bookid === 'book-1' &&
          body.synckey === 0
        ) {
          return jsonResponse({
            reviews: [
              { review: { reviewId: 'r1', content: '想法一', chapterUid: 3 } },
            ],
            hasMore: 1,
            synckey: 99,
          })
        }
        return jsonResponse({
          reviews: [{ review: { reviewId: 'r2', content: '想法二' } }],
          hasMore: 0,
        })
      }),
    )

    const result = await fetchWereadFromApi(' wrk-secret ', progress)

    expect(result.books).toHaveLength(2)
    expect(result.books[0].content).toEqual([
      {
        chapterUid: 3,
        chapterTitle: '第三章',
        items: [
          expect.objectContaining({
            type: 'highlight',
            markText: 'book-1 划线',
          }),
          expect.objectContaining({ type: 'review', content: '想法一' }),
        ],
      },
      {
        chapterUid: undefined,
        chapterTitle: '',
        items: [expect.objectContaining({ type: 'review', content: '想法二' })],
      },
    ])
    expect(bodies).toContainEqual(
      expect.objectContaining({
        api_name: '/user/notebooks',
        lastSort: 20,
        skill_version: '1.0.4',
      }),
    )
    expect(bodies).toContainEqual(
      expect.objectContaining({
        api_name: '/review/list/mine',
        bookid: 'book-1',
        synckey: 99,
      }),
    )
    expect(bodies.every((body) => body.params === undefined)).toBe(true)
    expect(progress).toHaveBeenLastCalledWith({
      current: 2,
      total: 2,
      message: '获取完成，共导出 2 本书',
    })

    const firstRequest = vi.mocked(fetch).mock.calls[0]
    expect(firstRequest[0]).toBe('/api/weread')
    expect(
      (firstRequest[1]?.headers as Record<string, string>).Authorization,
    ).toBe('Bearer wrk-secret')
    expect(firstRequest[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('reports authentication failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({}, 401))),
    )

    await expect(fetchWereadFromApi('bad-key')).rejects.toThrow(
      '微信读书认证失败，请检查 API Key',
    )
  })

  it('reports request timeouts with a retryable message', async () => {
    const error = new Error('timed out')
    error.name = 'TimeoutError'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(error)),
    )

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      '微信读书请求超时，请重试',
    )
  })

  it('surfaces timeout details returned by the local gateway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ errmsg: '连接微信读书服务超时，请重试' }, 504),
        ),
      ),
    )

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      '连接微信读书服务超时，请重试',
    )
  })

  it('reports local gateway connection failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      '无法连接 Rerote 微信读书服务',
    )
  })

  it('stops when the official service requests a Skill upgrade', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ upgrade_info: { message: '请升级到新版' } }),
        ),
      ),
    )

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow('请升级到新版')
  })

  it('surfaces gateway business errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse({ errcode: 1001, errmsg: 'API Key 已失效' }),
        ),
      ),
    )

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      'API Key 已失效',
    )
  })

  it('rejects an account without notebooks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ books: [], hasMore: 0 }))),
    )

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      '微信读书账号中没有找到可导出的笔记',
    )
  })
})
