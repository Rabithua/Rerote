import { v4 as uuidv4 } from 'uuid'

import { normalizeContent, normalizeTags } from './shared'
import type {
  ConversionOptions,
  ConversionResult,
  RoteNote,
  WereadApiSourceData,
  WereadBookMeta,
  WereadNoteItem,
  WereadSourceData,
  WereadTextSourceData,
} from './types'

import { getCurrentLanguage } from '@/lib/i18n/config'

type WereadInput = WereadApiSourceData | WereadSourceData | WereadTextSourceData

interface NormalizedWereadNote {
  book: WereadBookMeta
  chapterTitle: string
  item: WereadNoteItem
}

const NOTE_COUNT_PATTERN = /^\d+\s*个笔记$/u
const CHAPTER_PATTERN = /^◆\s*(.+)$/u
const QUOTE_PATTERN = /^>{1,2}\s*(.*)$/u

export function convertWereadToRote(
  data: WereadInput,
  _selectedUserId?: number,
  options: ConversionOptions = {},
): ConversionResult {
  if (!isWereadSourceData(data)) {
    return failedResult(
      getCurrentLanguage() === 'zh'
        ? '无效的微信读书导出格式'
        : 'Invalid WeRead export format',
    )
  }

  const normalizedNotes =
    'text' in data
      ? parseWereadText(data.text)
      : 'books' in data
        ? data.books.flatMap(flattenJson)
        : flattenJson(data)

  if (normalizedNotes.length === 0) {
    return failedResult(
      getCurrentLanguage() === 'zh'
        ? '微信读书导出文件中没有找到划线或想法'
        : 'No highlights or reviews found in the WeRead export',
    )
  }

  const notes: Array<RoteNote> = []
  const errors: Array<string> = []

  normalizedNotes.forEach((source, index) => {
    try {
      notes.push(convertNote(source, options))
    } catch (error) {
      errors.push(
        `${source.book.title || 'WeRead'} ${index + 1}: ${(error as Error).message}`,
      )
    }
  })

  return {
    success: errors.length === 0,
    data: { articles: [], notes },
    errors,
    warnings: [],
    stats: {
      total: normalizedNotes.length,
      converted: notes.length,
      failed: errors.length,
      localAttachmentsSkipped: 0,
      articlesConverted: 0,
    },
  }
}

export function isWereadSourceData(data: unknown): data is WereadInput {
  if (!data || typeof data !== 'object') return false

  const record = data as Record<string, unknown>
  if (Array.isArray(record.books)) {
    return record.books.length > 0 && record.books.every(isStructuredSourceData)
  }
  if (typeof record.text === 'string') {
    return looksLikeWereadText(record.text)
  }

  return isStructuredSourceData(record)
}

function isStructuredSourceData(data: unknown): data is WereadSourceData {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  if (
    !record.meta ||
    typeof record.meta !== 'object' ||
    !Array.isArray(record.content)
  ) {
    return false
  }

  const meta = record.meta as Record<string, unknown>
  return (
    typeof meta.title === 'string' &&
    record.content.every(
      (chapter) =>
        !!chapter &&
        typeof chapter === 'object' &&
        Array.isArray((chapter as Record<string, unknown>).items),
    )
  )
}

function flattenJson(data: WereadSourceData): Array<NormalizedWereadNote> {
  return data.content.flatMap((chapter) =>
    chapter.items.flatMap((item) =>
      isValidItem(item)
        ? [
            {
              book: data.meta,
              chapterTitle: chapter.chapterTitle?.trim() ?? '',
              item,
            },
          ]
        : [],
    ),
  )
}

function parseWereadText(text: string): Array<NormalizedWereadNote> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const nonEmptyHeader = lines.map((line) => line.trim()).filter(Boolean)
  const noteCountIndex = nonEmptyHeader.findIndex((line) =>
    NOTE_COUNT_PATTERN.test(line),
  )
  const title = nonEmptyHeader[0] ?? '微信读书'
  const author =
    noteCountIndex > 1 ? nonEmptyHeader[noteCountIndex - 1] : undefined
  const book: WereadBookMeta = { title, author }
  const notes: Array<NormalizedWereadNote> = []
  let chapterTitle = ''
  let pendingThought: Array<string> = []

  const flushThought = () => {
    const content = pendingThought.join('\n').trim()
    if (content) {
      notes.push({ book, chapterTitle, item: { type: 'review', content } })
    }
    pendingThought = []
  }

  for (const rawLine of lines.slice(
    noteCountIndex >= 0 ? noteCountIndex + 1 : 0,
  )) {
    const line = rawLine.trim()
    const chapterMatch = line.match(CHAPTER_PATTERN)
    if (chapterMatch) {
      flushThought()
      chapterTitle = chapterMatch[1].trim()
      continue
    }

    const quoteMatch = line.match(QUOTE_PATTERN)
    if (quoteMatch) {
      flushThought()
      const markText = quoteMatch[1].trim()
      if (markText) {
        notes.push({
          book,
          chapterTitle,
          item: { type: 'highlight', markText },
        })
      }
      continue
    }

    if (line) pendingThought.push(line)
    else flushThought()
  }

  flushThought()
  return notes
}

function convertNote(
  source: NormalizedWereadNote,
  options: ConversionOptions,
): RoteNote {
  const rawContent = buildContent(source.item)
  if (!rawContent) throw new Error('笔记内容为空')

  const timestamp = parseTimestamp(
    source.item.createTime ?? source.item.createTimeFormatted,
  )
  const tags = normalizeTags(
    ['微信读书', source.book.title, source.book.category],
    rawContent,
  )

  return {
    id: uuidv4(),
    title: [source.book.title, source.chapterTitle].filter(Boolean).join(' · '),
    type: 'Rote',
    tags,
    content: normalizeContent(rawContent, options),
    state: 'private',
    archived: false,
    authorid: 'weread',
    articleId: null,
    pin: false,
    editor: 'normal',
    createdAt: timestamp,
    updatedAt: timestamp,
    author: {
      username: 'weread',
      nickname: '微信读书',
      avatar: null,
    },
    attachments: [],
    reactions: [],
  }
}

function buildContent(item: WereadNoteItem): string {
  if (item.type === 'highlight') return item.markText?.trim() ?? ''

  const abstract = item.abstract?.trim()
  const thought = item.content?.trim()
  if (abstract && thought)
    return `> ${abstract.replace(/\n/g, '\n> ')}\n\n${thought}`
  return thought ?? abstract ?? ''
}

function isValidItem(item: WereadNoteItem): boolean {
  return (
    (item.type === 'highlight' && hasText(item.markText)) ||
    (item.type === 'review' &&
      (hasText(item.content) || hasText(item.abstract)))
  )
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function looksLikeWereadText(text: string): boolean {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
  return (
    lines.some((line) => NOTE_COUNT_PATTERN.test(line)) &&
    lines.some((line) => CHAPTER_PATTERN.test(line) || QUOTE_PATTERN.test(line))
  )
}

function parseTimestamp(value: number | string | undefined): string {
  if (value === undefined || value === '') return new Date().toISOString()

  if (typeof value === 'number') {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value
    const date = new Date(milliseconds)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (Number.isFinite(numeric) && value.trim()) return parseTimestamp(numeric)

    const normalized = new Date(
      value.includes('T') ? value : value.replace(' ', 'T'),
    )
    if (!Number.isNaN(normalized.getTime())) return normalized.toISOString()
  }

  return new Date().toISOString()
}

function failedResult(error: string): ConversionResult {
  return {
    success: false,
    errors: [error],
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
