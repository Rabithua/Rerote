import { v4 as uuidv4 } from 'uuid'

import { normalizeContent, normalizeTags } from './shared'
import type {
  ConversionOptions,
  ConversionResult,
  FlomoSourceData,
  RoteAttachment,
  RoteNote,
} from './types'

import { getCurrentLanguage } from '@/lib/i18n/config'

export function convertFlomoToRote(
  data: FlomoSourceData,
  _selectedUserId?: number,
  options: ConversionOptions = {},
): ConversionResult {
  const lang = getCurrentLanguage()

  if (!isFlomoSourceData(data)) {
    return createFailedResult(
      lang === 'zh' ? '无效的 flomo 导出格式' : 'Invalid flomo export format',
    )
  }

  const document = parseHtml(data.html)
  const memoElements = Array.from(document.querySelectorAll('.memo'))

  if (memoElements.length === 0) {
    return createFailedResult(
      lang === 'zh'
        ? '未在 flomo 导出文件中找到 MEMO'
        : 'No memos found in flomo export',
    )
  }

  const author = extractAuthor(document)
  const notes: Array<RoteNote> = []
  const errors: Array<string> = []
  const warnings: Array<string> = []
  let localAttachmentsSkipped = 0

  memoElements.forEach((memoElement, index) => {
    try {
      const contentElement = memoElement.querySelector('.content')
      const filesElement = memoElement.querySelector('.files')
      const rawTime = memoElement.querySelector('.time')?.textContent ?? ''
      const timestamp = parseFlomoTime(rawTime)
      const rawContent = contentElement
        ? extractContentText(contentElement)
        : ''
      const content = normalizeContent(rawContent, options)
      const { attachments, skippedCount } =
        convertFlomoAttachments(filesElement)

      localAttachmentsSkipped += skippedCount

      notes.push({
        id: uuidv4(),
        title: '',
        type: 'Rote',
        tags: normalizeTags([], rawContent),
        content,
        state: 'private',
        archived: false,
        authorid: author.id,
        articleId: null,
        pin: false,
        editor: 'normal',
        createdAt: timestamp,
        updatedAt: timestamp,
        author: {
          username: author.username,
          nickname: author.nickname,
          avatar: null,
        },
        attachments,
        reactions: [],
      })
    } catch (error) {
      errors.push(`flomo memo ${index + 1} 转换失败: ${(error as Error).message}`)
    }
  })

  if (localAttachmentsSkipped > 0) {
    warnings.push(
      lang === 'zh'
        ? `检测到 ${localAttachmentsSkipped} 个 flomo 本地或相对路径附件已被跳过。`
        : `Detected ${localAttachmentsSkipped} flomo local or relative attachments skipped.`,
    )
  }

  return {
    success: errors.length === 0,
    data: { articles: [], notes },
    errors,
    warnings,
    stats: {
      total: memoElements.length,
      converted: notes.length,
      failed: errors.length,
      localAttachmentsSkipped,
      articlesConverted: 0,
    },
  }
}

export function isFlomoSourceData(data: unknown): data is FlomoSourceData {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof (data as FlomoSourceData).html === 'string' &&
    (data as FlomoSourceData).html.includes('flomo') &&
    (data as FlomoSourceData).html.includes('class="memo"')
  )
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function extractAuthor(document: Document) {
  const nameElement = document.querySelector('header .top .user .name')
  const rawName = nameElement ? nameElement.textContent.trim() : 'flomo'
  const username = rawName.replace(/^@/, '') || 'flomo'

  return {
    id: username,
    username,
    nickname: rawName,
  }
}

function parseFlomoTime(rawTime: string): string {
  const trimmed = rawTime.trim()
  const normalized = trimmed
    ? new Date(`${trimmed.replace(' ', 'T')}+08:00`)
    : new Date()

  if (Number.isNaN(normalized.getTime())) {
    return new Date().toISOString()
  }

  return normalized.toISOString()
}

function extractContentText(contentElement: Element): string {
  const lines: Array<string> = []

  Array.from(contentElement.childNodes).forEach((node) => {
    collectBlockText(node, lines)
  })

  return compactBlankLines(lines).join('\n').trim()
}

function collectBlockText(node: Node, lines: Array<string>) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeInlineText(node.textContent ?? '')
    if (text) lines.push(text)
    return
  }

  if (!(node instanceof Element)) return

  const tagName = node.tagName.toLowerCase()

  if (tagName === 'br') {
    lines.push('')
    return
  }

  if (tagName === 'p') {
    lines.push(normalizeInlineText(extractInlineText(node)))
    return
  }

  if (tagName === 'ul' || tagName === 'ol') {
    Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .forEach((li) => {
        const marker = tagName === 'ol' ? '1. ' : '- '
        lines.push(`${marker}${normalizeInlineText(extractInlineText(li))}`)
      })
    return
  }

  if (tagName === 'li') {
    lines.push(`- ${normalizeInlineText(extractInlineText(node))}`)
    return
  }

  Array.from(node.childNodes).forEach((child) => {
    collectBlockText(child, lines)
  })
}

function extractInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (!(node instanceof Element)) return ''

  const tagName = node.tagName.toLowerCase()

  if (tagName === 'br') return '\n'
  if (tagName === 'img') {
    return node.getAttribute('alt') ?? ''
  }

  return Array.from(node.childNodes).map(extractInlineText).join('')
}

function normalizeInlineText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function compactBlankLines(lines: Array<string>): Array<string> {
  const compacted: Array<string> = []

  lines.forEach((line) => {
    const isBlank = !line.trim()
    const previousBlank =
      compacted.length > 0 && !compacted[compacted.length - 1].trim()

    if (isBlank && previousBlank) return
    compacted.push(line)
  })

  return compacted
}

function convertFlomoAttachments(filesElement: Element | null): {
  attachments: Array<RoteAttachment>
  skippedCount: number
} {
  if (!filesElement) {
    return { attachments: [], skippedCount: 0 }
  }

  const mediaElements = Array.from(
    filesElement.querySelectorAll('img[src], audio[src], video[src], a[href]'),
  )
  let skippedCount = 0

  const attachments = mediaElements.flatMap((element, index) => {
    const url = element.getAttribute('src') ?? element.getAttribute('href') ?? ''
    if (!isRemoteUrl(url)) {
      skippedCount++
      return []
    }

    return [createAttachment(url, element, index)]
  })

  return { attachments, skippedCount }
}

function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function createAttachment(
  url: string,
  element: Element,
  sortIndex: number,
): RoteAttachment {
  const now = new Date().toISOString()

  return {
    id: uuidv4(),
    url,
    compressUrl: url,
    userid: '',
    roteid: '',
    storage: 'REMOTE',
    details: {
      key: extractFilename(url),
      size: 0,
      mtime: now,
      mimetype: inferMimeType(url, element),
      compressKey: '',
    },
    createdAt: now,
    updatedAt: now,
    sortIndex,
  }
}

function extractFilename(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname.split('/').filter(Boolean).pop() ?? ''
  } catch {
    return url.split('/').filter(Boolean).pop() ?? ''
  }
}

function inferMimeType(url: string, element: Element): string {
  const tagName = element.tagName.toLowerCase()
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase()

  if (tagName === 'audio') return `audio/${extension || 'mpeg'}`
  if (tagName === 'video') return `video/${extension || 'mp4'}`
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'svg') return 'image/svg+xml'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'

  return 'application/octet-stream'
}

function createFailedResult(message: string): ConversionResult {
  return {
    success: false,
    errors: [message],
    warnings: [],
    stats: {
      total: 0,
      converted: 0,
      failed: 1,
      localAttachmentsSkipped: 0,
      articlesConverted: 0,
    },
  }
}
