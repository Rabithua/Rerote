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

  it('skips bookmark-only books and only requests each needed note type', async () => {
    const bodies: Array<RequestBody> = []
    const progress = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        await Promise.resolve()
        const body = JSON.parse(String(init?.body)) as RequestBody
        bodies.push(body)

        if (body.api_name === '/user/notebooks') {
          return jsonResponse({
            books: [
              {
                bookId: 'bookmark-only',
                noteCount: 0,
                reviewCount: 0,
                bookmarkCount: 8,
                book: { bookId: 'bookmark-only', title: '只有书签' },
              },
              {
                bookId: 'highlight-only',
                noteCount: 2,
                reviewCount: 0,
                bookmarkCount: 0,
                book: { bookId: 'highlight-only', title: '只有划线' },
              },
              {
                bookId: 'review-only',
                noteCount: 0,
                reviewCount: 1,
                bookmarkCount: 0,
                book: { title: '只有想法' },
              },
            ],
            hasMore: 0,
          })
        }
        if (body.api_name === '/book/bookmarklist') {
          return jsonResponse({
            book: { bookId: body.bookId, title: '只有划线' },
            updated: [
              {
                bookmarkId: 'mark-1',
                markText: '一条划线',
              },
            ],
          })
        }
        return jsonResponse({
          reviews: [{ review: { reviewId: 'review-1', content: '一条想法' } }],
          hasMore: 0,
        })
      }),
    )

    const result = await fetchWereadFromApi('wrk-key', progress)

    expect(result.books.map((book) => book.meta.bookId)).toEqual([
      'highlight-only',
      'review-only',
    ])
    expect(
      bodies.filter((body) => body.api_name === '/book/bookmarklist'),
    ).toEqual([
      expect.objectContaining({
        api_name: '/book/bookmarklist',
        bookId: 'highlight-only',
      }),
    ])
    expect(
      bodies.filter((body) => body.api_name === '/review/list/mine'),
    ).toEqual([
      expect.objectContaining({
        api_name: '/review/list/mine',
        bookid: 'review-only',
      }),
    ])
    expect(bodies.some((body) => body.bookId === 'bookmark-only')).toBe(false)
    expect(bodies.some((body) => body.bookid === 'bookmark-only')).toBe(false)
    expect(progress).toHaveBeenLastCalledWith({
      current: 2,
      total: 2,
      message: '获取完成，共导出 2 本书',
    })
  })

  it('keeps the compatible request fallback when notebook counts are missing', async () => {
    const bodies: Array<RequestBody> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        await Promise.resolve()
        const body = JSON.parse(String(init?.body)) as RequestBody
        bodies.push(body)

        if (body.api_name === '/user/notebooks') {
          return jsonResponse({
            books: [{ bookId: 'legacy', book: { title: '旧响应' } }],
            hasMore: 0,
          })
        }
        if (body.api_name === '/book/bookmarklist') {
          return jsonResponse({
            updated: [{ bookmarkId: 'mark-1', markText: '兼容划线' }],
          })
        }
        return jsonResponse({ reviews: [], hasMore: 0 })
      }),
    )

    await fetchWereadFromApi('wrk-key')

    expect(bodies.map((body) => body.api_name)).toEqual([
      '/user/notebooks',
      '/book/bookmarklist',
      '/review/list/mine',
    ])
  })

  it('rejects accounts that only contain bookmarks without detail requests', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          books: [
            {
              bookId: 'bookmark-only',
              noteCount: 0,
              reviewCount: 0,
              bookmarkCount: 5,
            },
          ],
          hasMore: 0,
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      '微信读书账号中没有找到可导出的划线或想法',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not return empty books when notebook counts are stale', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      await Promise.resolve()
      const body = JSON.parse(String(init?.body)) as RequestBody
      if (body.api_name === '/user/notebooks') {
        return jsonResponse({
          books: [
            {
              bookId: 'stale-counts',
              noteCount: 1,
              reviewCount: 1,
              book: { bookId: 'stale-counts', title: '计数已过期' },
            },
          ],
          hasMore: 0,
        })
      }
      if (body.api_name === '/book/bookmarklist') {
        return jsonResponse({ updated: [] })
      }
      return jsonResponse({ reviews: [], hasMore: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchWereadFromApi('wrk-key')).rejects.toThrow(
      '微信读书账号中没有找到可导出的划线或想法',
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
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
