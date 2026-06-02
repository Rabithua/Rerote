import { beforeAll, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'

import { convertFlomoToRote, isFlomoSourceData } from './flomo-to-rote'

describe('flomo to Rote converter', () => {
  beforeAll(() => {
    const { window } = new JSDOM('')
    vi.stubGlobal('DOMParser', window.DOMParser)
    vi.stubGlobal('Element', window.Element)
    vi.stubGlobal('Node', window.Node)
  })

  it('should convert flomo HTML memos to Rote notes', () => {
    const result = convertFlomoToRote({
      html: `
        <html>
          <head><title>flomo · 浮墨笔记</title></head>
          <body>
            <header>
              <div class="top">
                <div class="user">
                  <div class="name">@alice</div>
                </div>
              </div>
            </header>
            <div class="memos">
              <div class="memo">
                <div class="time">2024-01-02 12:34:56</div>
                <div class="content">
                  <p>Hello #tag #tag,</p>
                  <ul><li><p>List item</p></li></ul>
                </div>
                <div class="files">
                  <img src="https://example.com/image.png" />
                  <audio src="./local-audio.mp3"></audio>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
      filename: 'flomo.html',
    })

    const note = result.data?.notes[0]

    expect(result.success).toBe(true)
    expect(result.stats.total).toBe(1)
    expect(result.stats.converted).toBe(1)
    expect(result.stats.localAttachmentsSkipped).toBe(1)
    expect(result.warnings).toHaveLength(1)
    expect(note?.author.username).toBe('alice')
    expect(note?.createdAt).toBe('2024-01-02T04:34:56.000Z')
    expect(note?.content).toBe('Hello #tag #tag,\n- List item')
    expect(note?.tags).toEqual(['tag'])
    expect(note?.attachments).toHaveLength(1)
    expect(note?.attachments[0].url).toBe('https://example.com/image.png')
    expect(note?.attachments[0].details.mimetype).toBe('image/png')
  })

  it('should validate flomo source data', () => {
    expect(
      isFlomoSourceData({
        html: '<html><title>flomo</title><div class="memo"></div></html>',
      }),
    ).toBe(true)
    expect(isFlomoSourceData({ html: '<html></html>' })).toBe(false)
  })

  it('should fail when no memo nodes are present', () => {
    const result = convertFlomoToRote({
      html: '<html><title>flomo · 浮墨笔记</title></html>',
    })

    expect(result.success).toBe(false)
    expect(result.stats.failed).toBe(1)
  })
})
