// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import {
  convertDinoxToRote,
  isDinoxSourceData,
  parseDinoxTime,
} from './dinox-to-rote'

const fixture = [
  {
    title: '标题',
    contentMd: '完整正文\n\n第二段 #正文标签',
    contentText: '截断',
    tags: ['生活/读书'],
    createTime: '2024-01-02 03:04:05',
    type: 'note',
  },
  {
    title: '已在首段',
    contentMd: '# 已在首段\n\n正文',
    createTime: '2024-01-02T03:04:05+08:00',
  },
  {
    title: '',
    contentMd:
      '![](https://example.test/one.png)<!-- {"kind":"image","resourceId":"resource-one"} -->',
    createTime: '2024-01-02 03:04:05',
  },
  {
    title: '',
    contentMd: ' \n ',
    contentText: '',
    contentHtml: '<p></p>',
    createTime: 'invalid',
  },
]

describe('Dinox JSON conversion', () => {
  test('root format and synthetic four-record fixture', () => {
    expect(isDinoxSourceData(fixture)).toBe(true)
    expect(isDinoxSourceData({ notes: fixture })).toBe(false)
    expect(isDinoxSourceData([null])).toBe(false)
    const result = convertDinoxToRote(fixture)
    expect(result.success).toBe(true)
    expect(result.stats).toMatchObject({
      total: 4,
      converted: 3,
      skipped: 1,
      failed: 0,
    })
    const [first, second, third] = result.data!.notes
    expect(first.content).toBe('标题\n\n完整正文\n\n第二段 #正文标签')
    expect(first.tags).toEqual(['生活/读书'])
    expect(first.createdAt).toBe('2024-01-01T19:04:05.000Z')
    expect(first.updatedAt).toBeUndefined()
    expect(first.source.sourceUpdatedAt).toBeUndefined()
    expect(first.state).toBe('private')
    expect(second.content).toBe('# 已在首段\n\n正文')
    expect(third.content).toBe('')
    expect(third.attachments).toHaveLength(1)
    expect(third.attachments[0].url).toBe('https://example.test/one.png')
  })
  test('identity is stable across files, selection/display options, and repeated identical records', () => {
    const first = convertDinoxToRote([...fixture, fixture[0]])
    const second = convertDinoxToRote(fixture, undefined, {
      cleanMarkdown: true,
      preserveVisibility: true,
    })
    expect(first.data!.notes.slice(0, 3).map((note) => note.source)).toEqual(
      second.data!.notes.map((note) => note.source),
    )
    expect(first.data!.notes[0].source.externalId).not.toBe(
      first.data!.notes[3].source.externalId,
    )
    expect(
      new Set(first.data!.notes.map((note) => note.source.accountId)).size,
    ).toBe(1)
    const changed = convertDinoxToRote([
      {
        ...fixture[2],
        contentMd: fixture[2].contentMd.replace('resource-one', 'resource-two'),
      },
    ])
    expect(changed.data!.notes[0].source.externalId).not.toBe(
      first.data!.notes[2].source.externalId,
    )
  })
  test('extracts images in order, removes adjacent comments, and leaves code untouched', () => {
    const contentMd =
      '![a](https://example.test/a.png)<!-- kind:image resourceId:a -->\n\n```md\n![](https://example.test/code.png)<!-- kind:image resourceId:code -->\n#not-a-tag\n```\n\n<!-- {"kind":"image","resourceId":"b"} -->![b](https://example.test/b.png)\n#outside `#inline`'
    const note = convertDinoxToRote([
      { contentMd, createTime: '2020-01-01 00:00:00' },
    ]).data!.notes[0]
    expect(note.attachments.map((attachment) => attachment.url)).toEqual([
      'https://example.test/a.png',
      'https://example.test/b.png',
    ])
    expect(note.attachments.map((attachment) => attachment.sortIndex)).toEqual([
      0, 1,
    ])
    expect(note.content).toContain('https://example.test/code.png')
    expect(note.content).not.toContain('resourceId:a')
    expect(note.content).not.toContain('"resourceId":"b"')
    expect(note.tags).toEqual(['outside'])
  })
  test('keeps title-only notes, HTML fallback images, and reports invalid dates', () => {
    const imageTitle = convertDinoxToRote([
      {
        title: 'Image title',
        contentMd:
          '![Image title](https://example.test/a.png)<!-- kind:image resourceId:a -->![](https://example.test/b.png)',
        createTime: '2020-01-01 00:00:00',
      },
    ]).data!.notes[0]
    expect(imageTitle.content).toBe('Image title')
    expect(imageTitle.attachments).toHaveLength(2)
    expect(
      convertDinoxToRote([
        { title: 'only title', createTime: '2020-01-01 00:00:00' },
      ]).data!.notes[0].content,
    ).toBe('only title')
    const html = convertDinoxToRote([
      {
        contentHtml: '<p>text</p><img src="https://example.test/image.png">',
        createTime: '2020-01-01 00:00:00',
      },
    ])
    expect(html.data!.notes[0].attachments).toHaveLength(1)
    expect(
      convertDinoxToRote([{ title: 'bad', createTime: '2023-02-29 01:02:03' }])
        .stats.failed,
    ).toBe(1)
    expect(() => parseDinoxTime('2020-01-01 24:00:00')).toThrow(
      'dinox_invalid_date',
    )
    expect(parseDinoxTime('2020-01-01T00:00:00Z')).toBe(
      '2020-01-01T00:00:00.000Z',
    )
  })
})
