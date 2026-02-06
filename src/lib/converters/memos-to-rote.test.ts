import { describe, expect, it } from 'vitest'
import type { MemoSourceData } from '@/lib/converters/types'
import { convertMemosToRote } from '@/lib/converters/memos-to-rote'

describe('Memos to Rote converter', () => {
  it('should convert valid memos data', () => {
    const mockData: MemoSourceData = {
      memos: [
        {
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
        },
      ],
      nextPageToken: '',
    }

    const result = convertMemosToRote(mockData)

    expect(result.success).toBe(true)
    expect(result.stats.total).toBe(1)
    expect(result.stats.converted).toBe(1)
    expect(result.stats.failed).toBe(0)
    expect(result.data?.notes).toBeDefined()
    expect(result.data?.notes.length).toBe(1)

    const note = result.data?.notes[0]
    expect(note?.title).toBe('')
    expect(note?.content).toContain('This is a test memo')
    expect(note?.tags).toEqual(['test', 'sample'])
    expect(note?.state).toBe('private')
    expect(note?.pin).toBe(false)
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
