import { describe, expect, it } from 'vitest'
import type { MemoSourceData, SQLiteSourceData } from '@/lib/converters/types'
import { convertMemosToRote } from '@/lib/converters/memos-to-rote'

describe('Memos to Rote converter', () => {
  const baseMemo: MemoSourceData['memos'][number] = {
    name: 'memos/test123',
    state: 'NORMAL',
    creator: 'users/1',
    createTime: '2024-01-01T00:00:00Z',
    updateTime: '2024-01-01T00:00:00Z',
    displayTime: '2024-01-01T00:00:00Z',
    content: '# Test Note\nThis is a test memo.',
    visibility: 'PRIVATE',
    tags: ['test', 'sample'],
    pinned: false,
    attachments: [],
    relations: [],
    reactions: [],
    property: {
      hasLink: false,
      hasTaskList: false,
      hasCode: false,
      hasIncompleteTasks: false,
    },
    snippet: 'Test Note This is a test memo.',
  }

  it('should convert valid memos data', () => {
    const mockData: MemoSourceData = {
      memos: [baseMemo],
      nextPageToken: '',
    }

    const result = convertMemosToRote(mockData)

    expect(result.success).toBe(true)
    expect(result.stats.total).toBe(1)
    expect(result.stats.converted).toBe(1)
    expect(result.stats.failed).toBe(0)
    expect(result.data?.articles).toBeDefined()
    expect(result.data?.articles.length).toBe(0)
    expect(result.stats.articlesConverted).toBe(0)
    expect(result.data?.notes).toBeDefined()
    expect(result.data?.notes.length).toBe(1)

    const note = result.data?.notes[0]
    expect(note?.title).toBe('')
    expect(note?.content).toContain('This is a test memo')
    expect(note?.tags).toEqual(['test', 'sample'])
    expect(note?.state).toBe('private')
    expect(note?.pin).toBe(false)
  })

  it('should clean markdown when requested', () => {
    const result = convertMemosToRote(
      {
        memos: [
          {
            ...baseMemo,
            content: '## Title\n\n- **Bold** [Link](https://example.com)',
          },
        ],
        nextPageToken: '',
      },
      undefined,
      { cleanMarkdown: true },
    )

    const note = result.data?.notes[0]

    expect(note?.content).toBe('Title\n\nBold Link')
  })

  it('should normalize tags from explicit metadata and content', () => {
    const result = convertMemosToRote({
      memos: [
        {
          ...baseMemo,
          content: 'Body #fallback #nested/tag,',
          tags: ['#explicit', 'sample'],
          property: {
            ...baseMemo.property,
            tags: ['property-only'],
          },
        },
      ],
      nextPageToken: '',
    })

    const note = result.data?.notes[0]

    expect(note?.tags).toEqual([
      'explicit',
      'sample',
      'property-only',
      'fallback',
      'nested/tag',
    ])
  })

  it('should convert API memos that omit optional tag metadata', () => {
    const result = convertMemosToRote({
      memos: [
        {
          ...baseMemo,
          content: 'Legacy export #fallback',
          tags: undefined,
          property: undefined,
        },
      ],
      nextPageToken: '',
    })

    const note = result.data?.notes[0]

    expect(result.success).toBe(true)
    expect(result.stats.converted).toBe(1)
    expect(note?.content).toBe('Legacy export #fallback')
    expect(note?.tags).toEqual(['fallback'])
  })

  it('should parse sqlite payload tags and map protected notes to private', () => {
    const data: SQLiteSourceData = {
      users: [
        {
          id: 1,
          created_ts: 1704067200,
          updated_ts: 1704067200,
          row_status: 'NORMAL',
          username: 'demo',
          role: 'USER',
          email: '',
          nickname: '',
          avatar_url: '',
          description: '',
        },
      ],
      memos: [
        {
          id: 1,
          uid: 'memo-uid',
          creator_id: 1,
          created_ts: 1704067200,
          updated_ts: 1704067200,
          row_status: 'NORMAL',
          content: 'SQLite memo #inline',
          visibility: 'PROTECTED',
          pinned: false,
          payload: {
            tags: ['#sqlite'],
          },
        },
      ],
      attachments: [],
    }

    const result = convertMemosToRote(data, 1)
    const note = result.data?.notes[0]

    expect(note?.tags).toEqual(['sqlite', 'inline'])
    expect(note?.state).toBe('private')
  })

  it('should handle invalid data', () => {
    const invalidData = {
      invalid: 'data',
    }

    // @ts-expect-error Testing invalid data type
    const result = convertMemosToRote(invalidData)

    expect(result.success).toBe(false)
    expect(result.stats.total).toBe(0)
    expect(result.stats.failed).toBeGreaterThan(0)
  })
})
