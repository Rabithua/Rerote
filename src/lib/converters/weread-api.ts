import type { FetchProgress } from './memos-api'
import type {
  WereadApiSourceData,
  WereadBookMeta,
  WereadChapter,
  WereadNoteItem,
} from './types'

const API_URL = '/api/weread'
const SKILL_VERSION = '1.0.4'
const REQUEST_TIMEOUT_MS = 35_000

interface GatewayResponse {
  errcode?: number
  errmsg?: string
  upgrade_info?: { message?: string }
  [key: string]: unknown
}

interface NotebookBook {
  bookId: string
  sort?: number
  book?: WereadBookMeta
}

interface NotebooksResponse extends GatewayResponse {
  books?: Array<NotebookBook>
  hasMore?: number
}

interface BookmarkResponse extends GatewayResponse {
  updated?: Array<Record<string, unknown>>
  chapters?: Array<Record<string, unknown>>
  book?: WereadBookMeta
}

interface ReviewsResponse extends GatewayResponse {
  reviews?: Array<{ review?: Record<string, unknown> }>
  hasMore?: number
  synckey?: number
}

export async function fetchWereadFromApi(
  apiKey: string,
  onProgress?: (progress: FetchProgress) => void,
): Promise<WereadApiSourceData> {
  const notebooks = await fetchAllNotebooks(apiKey, onProgress)
  const books = []

  for (let index = 0; index < notebooks.length; index++) {
    const notebook = notebooks[index]
    onProgress?.({
      current: index,
      total: notebooks.length,
      message: `正在导出《${notebook.book?.title ?? notebook.bookId}》的笔记…`,
    })

    const [bookmarkData, reviewItems] = await Promise.all([
      gatewayRequest<BookmarkResponse>(apiKey, '/book/bookmarklist', {
        bookId: notebook.bookId,
      }),
      fetchAllReviews(apiKey, notebook.bookId),
    ])

    books.push(buildBookSource(notebook, bookmarkData, reviewItems))
  }

  onProgress?.({
    current: books.length,
    total: books.length,
    message: `获取完成，共导出 ${books.length} 本书`,
  })
  return { books }
}

async function fetchAllNotebooks(
  apiKey: string,
  onProgress?: (progress: FetchProgress) => void,
): Promise<Array<NotebookBook>> {
  const books: Array<NotebookBook> = []
  let lastSort: number | undefined
  let hasMore: boolean

  do {
    onProgress?.({
      current: books.length,
      total: null,
      message: '正在获取微信读书笔记本…',
    })
    const response = await gatewayRequest<NotebooksResponse>(
      apiKey,
      '/user/notebooks',
      { count: 100, ...(lastSort === undefined ? {} : { lastSort }) },
    )
    const page = Array.isArray(response.books) ? response.books : []
    books.push(...page.filter((book) => typeof book.bookId === 'string'))

    hasMore = response.hasMore === 1 && page.length > 0
    if (hasMore) {
      const nextSort = page[page.length - 1].sort
      if (typeof nextSort !== 'number' || nextSort === lastSort) {
        throw new Error('微信读书笔记本分页游标无效')
      }
      lastSort = nextSort
    }
  } while (hasMore)

  if (books.length === 0) throw new Error('微信读书账号中没有找到可导出的笔记')
  return books
}

async function fetchAllReviews(
  apiKey: string,
  bookId: string,
): Promise<Array<Record<string, unknown>>> {
  const reviews: Array<Record<string, unknown>> = []
  let synckey = 0
  let hasMore: boolean

  do {
    const response = await gatewayRequest<ReviewsResponse>(
      apiKey,
      '/review/list/mine',
      { bookid: bookId, count: 100, synckey },
    )
    reviews.push(
      ...(response.reviews ?? []).flatMap((item) =>
        item.review ? [item.review] : [],
      ),
    )
    hasMore = response.hasMore === 1
    if (hasMore) {
      if (
        typeof response.synckey !== 'number' ||
        response.synckey === synckey
      ) {
        throw new Error('微信读书想法分页游标无效')
      }
      synckey = response.synckey
    }
  } while (hasMore)

  return reviews
}

function buildBookSource(
  notebook: NotebookBook,
  bookmarkData: BookmarkResponse,
  reviews: Array<Record<string, unknown>>,
) {
  const chapterTitles = new Map<string, string>()
  for (const chapter of bookmarkData.chapters ?? []) {
    if (chapter.chapterUid !== undefined && typeof chapter.title === 'string') {
      chapterTitles.set(String(chapter.chapterUid), chapter.title)
    }
  }

  const chapters = new Map<string, WereadChapter>()
  const addItem = (
    chapterUid: unknown,
    chapterTitle: unknown,
    item: WereadNoteItem,
  ) => {
    const key = chapterUid === undefined ? 'book' : String(chapterUid)
    const existing = chapters.get(key) ?? {
      chapterUid:
        typeof chapterUid === 'string' || typeof chapterUid === 'number'
          ? chapterUid
          : undefined,
      chapterTitle:
        typeof chapterTitle === 'string'
          ? chapterTitle
          : (chapterTitles.get(key) ?? ''),
      items: [],
    }
    existing.items.push(item)
    chapters.set(key, existing)
  }

  for (const bookmark of bookmarkData.updated ?? []) {
    if (typeof bookmark.markText !== 'string') continue
    addItem(bookmark.chapterUid, undefined, {
      type: 'highlight',
      bookmarkId: stringValue(bookmark.bookmarkId),
      markText: bookmark.markText,
      createTime: timeValue(bookmark.createTime),
    })
  }

  for (const review of reviews) {
    if (
      typeof review.content !== 'string' &&
      typeof review.abstract !== 'string'
    )
      continue
    addItem(review.chapterUid, review.chapterName, {
      type: 'review',
      reviewId: stringValue(review.reviewId),
      content: stringValue(review.content),
      abstract: stringValue(review.abstract),
      createTime: timeValue(review.createTime),
    })
  }

  return {
    meta: bookmarkData.book ??
      notebook.book ?? { title: notebook.bookId, bookId: notebook.bookId },
    content: [...chapters.values()],
  }
}

async function gatewayRequest<T extends GatewayResponse>(
  apiKey: string,
  apiName: string,
  parameters: Record<string, unknown>,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_name: apiName,
        ...parameters,
        skill_version: SKILL_VERSION,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      throw new Error('微信读书请求超时，请重试')
    }
    throw new Error('无法连接 Rerote 微信读书服务')
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('微信读书认证失败，请检查 API Key')
    }
    const errorData = (await response
      .json()
      .catch(() => null)) as GatewayResponse | null
    if (errorData?.errmsg) throw new Error(errorData.errmsg)
    throw new Error(
      `微信读书请求失败：${response.status} ${response.statusText}`,
    )
  }

  const data = (await response.json()) as T
  if (data.upgrade_info) {
    throw new Error(data.upgrade_info.message ?? '微信读书 Skill 需要升级')
  }
  if (typeof data.errcode === 'number' && data.errcode !== 0) {
    throw new Error(data.errmsg || `微信读书接口错误：${data.errcode}`)
  }
  return data
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function timeValue(value: unknown): number | string | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : undefined
}
