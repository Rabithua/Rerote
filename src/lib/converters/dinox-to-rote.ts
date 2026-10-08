import { fromMarkdown } from 'mdast-util-from-markdown'
import { toString } from 'mdast-util-to-string'
import { v4 as uuidv4 } from 'uuid'
import {
  createAttachmentSource,
  createImportSource,
  stableSourceId,
} from './import-source'
import { normalizeContent, normalizeTags } from './shared'
import type { Root, RootContent } from 'mdast'
import type {
  ConversionOptions,
  ConversionResult,
  RoteAttachment,
  RoteNote,
} from './types'

export interface DinoxRecord {
  title?: string
  contentHtml?: string
  contentMd?: string
  contentText?: string
  tags?: Array<unknown>
  createTime?: string
  type?: string
}

export function isDinoxSourceData(data: unknown): data is Array<DinoxRecord> {
  return (
    Array.isArray(data) &&
    data.every((record: unknown) => {
      if (!record || typeof record !== 'object' || Array.isArray(record))
        return false
      const item = record as Record<string, unknown>
      return (
        [
          'title',
          'contentHtml',
          'contentMd',
          'contentText',
          'createTime',
          'type',
        ].every(
          (key) => item[key] === undefined || typeof item[key] === 'string',
        ) &&
        (item.tags === undefined || Array.isArray(item.tags))
      )
    })
  )
}

export function convertDinoxToRote(
  data: Array<DinoxRecord>,
  _user?: number,
  options: ConversionOptions = {},
): ConversionResult {
  const notes: Array<RoteNote> = []
  const errors: Array<string> = []
  const occurrences = new Map<string, number>()
  let skipped = 0
  data.forEach((record, index) => {
    try {
      const rawBody = record.contentMd?.trim()
        ? record.contentMd
        : record.contentHtml?.trim()
          ? htmlToMarkdown(record.contentHtml)
          : (record.contentText ?? '')
      // Identity is computed before image extraction, title insertion or display cleanup.
      const originalBody = record.contentMd?.trim()
        ? record.contentMd
        : record.contentHtml?.trim()
          ? record.contentHtml
          : (record.contentText ?? '')
      const signature = stableSourceId(
        record.createTime ?? '',
        record.title ?? '',
        originalBody,
      )
      const occurrence = occurrences.get(signature) ?? 0
      occurrences.set(signature, occurrence + 1)
      const source = createImportSource({
        provider: 'dinox',
        accountKey: 'dinox-export',
        externalKey: `${signature}:${occurrence}`,
      })
      const { content, images, tree } = extractImages(rawBody)
      const title = record.title?.trim() ?? ''
      if (
        !title &&
        !toString(tree)
          .replace(/\u2060/g, '')
          .trim() &&
        images.length === 0
      ) {
        skipped++
        return
      }
      const createdAt = parseDinoxTime(record.createTime)
      const firstText = fromMarkdown(content).children.find(
        (node) =>
          ['paragraph', 'heading'].includes(node.type) && toString(node).trim(),
      )
      const firstBlock = firstText ? toString(firstText).trim() : ''
      const body =
        title && !firstBlock.includes(title)
          ? `${title}\n\n${content}`.trim()
          : content
      const attachments: Array<RoteAttachment> = images.map(
        (image, sortIndex) => ({
          id: uuidv4(),
          url: image.url,
          compressUrl: '',
          userid: '',
          roteid: '',
          storage: 'REMOTE',
          details: {
            key: '',
            size: 0,
            mtime: createdAt,
            mimetype: '',
            compressKey: '',
          },
          createdAt,
          updatedAt: createdAt,
          sortIndex,
          source: createAttachmentSource(
            source,
            `${image.resourceId ?? image.url}:${sortIndex}`,
          ),
        }),
      )
      // Explicit tags are authoritative. AST text traversal excludes code and HTML comments.
      const tagText = textOutsideCode(tree)
      const explicitTags = normalizeTags(record.tags ?? [], '')
      notes.push({
        id: uuidv4(),
        title: '',
        type: 'Rote',
        tags: explicitTags.length ? explicitTags : normalizeTags([], tagText),
        content: normalizeContent(body, options),
        state: 'private',
        archived: false,
        authorid: '',
        articleId: null,
        pin: false,
        editor: 'normal',
        createdAt,
        author: { username: 'dinox', nickname: 'Dinox', avatar: null },
        attachments,
        reactions: [],
        source,
      })
    } catch (error) {
      errors.push(`Dinox ${index + 1}: ${(error as Error).message}`)
    }
  })
  return {
    success: errors.length === 0,
    data: { formatVersion: 2, articles: [], notes },
    errors,
    warnings: [],
    stats: {
      total: data.length,
      converted: notes.length,
      failed: errors.length,
      skipped,
      localAttachmentsSkipped: 0,
      articlesConverted: 0,
    },
  }
}

export function parseDinoxTime(value?: string): string {
  if (!value) throw new Error('dinox_invalid_date')
  const normalized = value.trim().replace(' ', 'T')
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(
      normalized,
    )
  if (!parts) throw new Error('dinox_invalid_date')
  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second = '00',
    fraction = '0',
    zone = '+08:00',
  ] = parts
  const local = new Date(
    Date.UTC(+year, +month - 1, +day, +hour, +minute, +second),
  )
  if (
    local.getUTCFullYear() !== +year ||
    local.getUTCMonth() !== +month - 1 ||
    local.getUTCDate() !== +day ||
    +hour > 23 ||
    +minute > 59 ||
    +second > 59
  )
    throw new Error('dinox_invalid_date')
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}.${fraction.padEnd(3, '0')}${zone}`,
  )
  if (!Number.isFinite(date.getTime())) throw new Error('dinox_invalid_date')
  return date.toISOString()
}

function extractImages(markdown: string) {
  const masked = markdown.replace(/<!--[^]*?-->/g, (comment) =>
    /kind["']?\s*[:=]\s*["']?image/i.test(comment)
      ? '\u2060' + comment.slice(1).replace(/[^\r\n]/g, ' ')
      : comment,
  )
  const tree = fromMarkdown(masked)
  const images: Array<{ url: string; resourceId?: string }> = []
  const removals: Array<[number, number]> = []
  const visit = (node: Root | RootContent) => {
    if (node.type === 'image' && /^https?:\/\//i.test(node.url)) {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start === undefined || end === undefined) return
      const after = /^\s*(<!--[^]*?-->)/.exec(markdown.slice(end))
      const before = /(<!--(?:(?!-->)[^])*?-->)\s*$/.exec(
        markdown.slice(0, start),
      )
      const resourceComment = [after?.[1], before?.[1]].find(
        (comment) => comment && /kind["']?\s*[:=]\s*["']?image/i.test(comment),
      )
      const resourceId = resourceComment?.match(
        /resourceId["']?\s*[:=]\s*["']?([^\s"',}<>]+)/i,
      )?.[1]
      if (resourceComment) {
        if (resourceComment === after?.[1])
          removals.push([end, end + after[0].length])
        else if (before?.index !== undefined)
          removals.push([before.index, start])
      }
      removals.push([start, end])
      images.push({ url: node.url, resourceId })
    }
    if ('children' in node) node.children.forEach((child) => visit(child))
  }
  visit(tree)
  let content = markdown
  const merged: Array<[number, number]> = []
  for (const [start, end] of removals.sort((a, b) => a[0] - b[0])) {
    const previous = merged.at(-1)
    if (previous && start <= previous[1])
      previous[1] = Math.max(previous[1], end)
    else merged.push([start, end])
  }
  merged.reverse().forEach(([start, end]) => {
    content = content.slice(0, start) + content.slice(end)
  })
  return { content: content.trim(), images, tree }
}

function textOutsideCode(node: Root | RootContent): string {
  if (
    node.type === 'code' ||
    node.type === 'inlineCode' ||
    node.type === 'html'
  )
    return ''
  if (node.type === 'text') return node.value
  return 'children' in node
    ? node.children
        .map((child) => textOutsideCode(child as RootContent))
        .join(' ')
    : ''
}

function htmlToMarkdown(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script,style').forEach((node) => node.remove())
  document
    .querySelectorAll('img')
    .forEach((image) =>
      image.replaceWith(
        document.createTextNode(`\n![](${image.getAttribute('src') ?? ''})\n`),
      ),
    )
  document
    .querySelectorAll('br')
    .forEach((node) => node.replaceWith(document.createTextNode('\n')))
  document
    .querySelectorAll('p,div,h1,h2,h3,li')
    .forEach((node) => node.appendChild(document.createTextNode('\n')))
  return document.body.textContent
}
