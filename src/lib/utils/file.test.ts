// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { readWereadFile } from './file'

describe('readWereadFile', () => {
  it('parses JSON exports', async () => {
    const file = new File(
      [JSON.stringify({ meta: { title: '书' }, content: [] })],
      'notes.JSON',
      { type: 'application/json' },
    )

    await expect(readWereadFile(file)).resolves.toEqual({
      meta: { title: '书' },
      content: [],
    })
  })

  it('wraps copied text with its filename', async () => {
    const file = new File(
      ['书名\n作者\n1个笔记\n◆ 章节\n>> 划线'],
      'notes.txt',
      {
        type: 'text/plain',
      },
    )

    await expect(readWereadFile(file)).resolves.toEqual({
      text: '书名\n作者\n1个笔记\n◆ 章节\n>> 划线',
      filename: 'notes.txt',
    })
  })

  it('reports malformed JSON', async () => {
    const file = new File(['{invalid'], 'notes.json')

    await expect(readWereadFile(file)).rejects.toThrow('无法解析 JSON 文件')
  })

  it('rejects unsupported file extensions', async () => {
    const file = new File(['notes'], 'notes.md')

    await expect(readWereadFile(file)).rejects.toThrow(
      '不支持的微信读书文件格式',
    )
  })
})
