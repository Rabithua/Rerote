import { beforeEach, describe, expect, it, vi } from 'vitest'

import { convertWereadToRote, isWereadSourceData } from './weread-to-rote'
import type { WereadSourceData } from './types'

vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-uuid') }))
vi.mock('@/lib/i18n/config', () => ({ getCurrentLanguage: () => 'zh' }))

const source: WereadSourceData = {
  meta: {
    bookId: '123',
    title: '测试之书',
    author: '测试作者',
    category: '文学',
  },
  content: [
    {
      chapterUid: 1,
      chapterTitle: '第一章',
      items: [
        {
          type: 'highlight',
          bookmarkId: 'bookmark-1',
          markText: '值得记住的 #句子',
          createTime: 1_700_000_000,
        },
        {
          type: 'review',
          reviewId: 'review-1',
          abstract: '书中的原文',
          content: '我的 #想法',
          createTimeFormatted: '2024-01-02 03:04:05',
        },
      ],
    },
  ],
}

describe('isWereadSourceData', () => {
  it('accepts a structured WeRead JSON backup', () => {
    expect(isWereadSourceData(source)).toBe(true)
  })

  it('accepts copied WeRead notes text', () => {
    expect(
      isWereadSourceData({
        text: '测试之书\n测试作者\n2个笔记\n\n◆ 第一章\n\n>> 一条划线',
      }),
    ).toBe(true)
  })

  it.each([
    null,
    {},
    { meta: { title: '书' } },
    { meta: { title: 1 }, content: [] },
    { meta: { title: '书' }, content: [{}] },
    { text: '普通文本，不是微信读书导出' },
  ])('rejects invalid input: %o', (input) => {
    expect(isWereadSourceData(input)).toBe(false)
  })
})

describe('convertWereadToRote', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
  })

  it('converts highlights and reviews while preserving context', () => {
    const result = convertWereadToRote(source)

    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.stats).toEqual({
      total: 2,
      converted: 2,
      failed: 0,
      localAttachmentsSkipped: 0,
      articlesConverted: 0,
    })
    expect(result.data?.articles).toEqual([])
    expect(result.data?.notes[0]).toMatchObject({
      id: 'test-uuid',
      title: '测试之书 · 第一章',
      content: '值得记住的 #句子',
      tags: ['微信读书', '测试之书', '文学', '句子'],
      authorid: 'weread',
      createdAt: '2023-11-14T22:13:20.000Z',
      updatedAt: '2023-11-14T22:13:20.000Z',
      attachments: [],
    })
    expect(result.data?.notes[1]).toMatchObject({
      title: '测试之书 · 第一章',
      content: '> 书中的原文\n\n我的 #想法',
      tags: ['微信读书', '测试之书', '文学', '想法'],
    })
  })

  it('converts the multi-book result returned by the official API', () => {
    const result = convertWereadToRote({
      books: [source, { ...source, meta: { title: '第二本书' } }],
    })

    expect(result.success).toBe(true)
    expect(result.stats.converted).toBe(4)
    expect(result.data?.notes[2].title).toBe('第二本书 · 第一章')
  })

  it('cleans Markdown without losing extracted tags', () => {
    const result = convertWereadToRote(source, undefined, {
      cleanMarkdown: true,
    })

    expect(result.data?.notes[1].content).toBe('书中的原文\n\n我的 #想法')
    expect(result.data?.notes[1].tags).toContain('想法')
  })

  it('converts copied text into highlights and thoughts', () => {
    const result = convertWereadToRote({
      text: [
        '卡片笔记写作法',
        '申克·阿伦斯',
        '3个笔记',
        '',
        '◆ 中文版序',
        '',
        '这是我的想法',
        '',
        '>> 引用文字',
        '> 另一条引用',
      ].join('\n'),
    })

    expect(result.success).toBe(true)
    expect(result.stats.converted).toBe(3)
    expect(result.data?.notes.map((note) => note.content)).toEqual([
      '这是我的想法',
      '引用文字',
      '另一条引用',
    ])
    expect(result.data?.notes[0].title).toBe('卡片笔记写作法 · 中文版序')
  })

  it('skips malformed JSON items and counts only convertible notes', () => {
    const result = convertWereadToRote({
      ...source,
      content: [
        {
          items: [
            { type: 'highlight' },
            { type: 'highlight', markText: '   ' },
            { type: 'review', content: '\n' },
            { type: 'review', content: '有效想法' },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.stats.total).toBe(1)
    expect(result.data?.notes[0].content).toBe('有效想法')
  })

  it('returns a diagnostic error for invalid input', () => {
    const result = convertWereadToRote({ text: 'not an export' })

    expect(result.success).toBe(false)
    expect(result.errors).toEqual(['无效的微信读书导出格式'])
    expect(result.data).toBeUndefined()
  })

  it('returns a diagnostic error when a valid export has no notes', () => {
    const result = convertWereadToRote({
      meta: { title: '空书' },
      content: [],
    })

    expect(result.success).toBe(false)
    expect(result.errors[0]).toContain('没有找到划线或想法')
    expect(result.stats.failed).toBe(1)
  })

  it('supports millisecond and numeric string timestamps', () => {
    const result = convertWereadToRote({
      meta: { title: '时间测试' },
      content: [
        {
          items: [
            {
              type: 'highlight',
              markText: '毫秒',
              createTime: 1_700_000_000_000,
            },
            { type: 'review', content: '数字字符串', createTime: '1700000000' },
          ],
        },
      ],
    })

    expect(result.data?.notes.map((note) => note.createdAt)).toEqual([
      '2023-11-14T22:13:20.000Z',
      '2023-11-14T22:13:20.000Z',
    ])
  })

  it('uses the current time when the source timestamp is absent or invalid', () => {
    const result = convertWereadToRote({
      meta: { title: '时间测试' },
      content: [
        {
          items: [
            { type: 'highlight', markText: '无时间' },
            { type: 'review', content: '坏时间', createTime: 'invalid' },
          ],
        },
      ],
    })

    expect(result.data?.notes.map((note) => note.createdAt)).toEqual([
      '2025-01-01T00:00:00.000Z',
      '2025-01-01T00:00:00.000Z',
    ])
  })
})
