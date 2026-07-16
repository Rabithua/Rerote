import { describe, expect, it } from 'vitest'

import { dedupeNotesBySource } from './import-source'
import type { RoteNote } from './types'

describe('import source identities', () => {
  it('does not confuse source tuples containing separators', () => {
    const first = createNote('a:b', 'c')
    const second = createNote('a', 'b:c')

    expect(dedupeNotesBySource([first, second])).toHaveLength(2)
  })
})

function createNote(accountId: string, externalId: string): RoteNote {
  return {
    id: crypto.randomUUID(),
    title: '',
    type: 'Rote',
    tags: [],
    content: 'content',
    state: 'private',
    archived: false,
    authorid: 'author',
    articleId: null,
    pin: false,
    editor: 'normal',
    createdAt: '2026-07-16T00:00:00.000Z',
    updatedAt: '2026-07-16T00:00:00.000Z',
    author: { username: 'author', nickname: 'author', avatar: null },
    attachments: [],
    reactions: [],
    source: { provider: 'memos', accountId, externalId },
  }
}
