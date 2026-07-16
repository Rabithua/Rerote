import { describe, expect, it } from 'vitest'

import { Platform, getConverter } from './index'

describe('WeRead converter registration', () => {
  it('registers official API and offline file modes', () => {
    const converter = getConverter(Platform.WEREAD)

    expect(converter).toMatchObject({
      platform: Platform.WEREAD,
      name: '微信读书',
      supportedModes: ['api', 'file'],
      acceptedFormats: '.json,.txt',
    })
  })

  it('validates structured and copied-text exports through the registry', () => {
    const converter = getConverter(Platform.WEREAD)

    expect(converter?.validate({ meta: { title: '书' }, content: [] })).toBe(
      true,
    )
    expect(
      converter?.validate({ text: '书\n作者\n1个笔记\n◆ 章节\n>> 划线' }),
    ).toBe(true)
    expect(converter?.validate({ content: [] })).toBe(false)
  })
})
