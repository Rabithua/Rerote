import { createImagePreview } from './image-preview'
import { createVideoPoster } from './video-poster'
import { ImportFailure } from './types'
import type { PreparedMedia } from './types'

export async function detectMediaType(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.slice(0, 512).arrayBuffer())
  const text = new TextDecoder().decode(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg'
  if (bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10')
    return 'image/png'
  if (/^GIF8[79]a/.test(text)) return 'image/gif'
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP')
    return 'image/webp'
  if (text.slice(4, 8) === 'ftyp') {
    const brands = text.slice(8, 48)
    if (/avif|avis/.test(brands)) return 'image/avif'
    if (/heic|heix|hevc|hevx/.test(brands)) return 'image/heic'
    if (/mif1|msf1/.test(brands)) return 'image/heif'
    if (brands.startsWith('qt  ')) return 'video/quicktime'
    return 'video/mp4'
  }
  if (bytes.slice(0, 4).join(',') === '26,69,223,163') return 'video/webm'
  if (/^(?:\s|<\?xml[^]*?\?>|<!--[^]*?-->)*<svg(?:\s|>)/i.test(text))
    return 'image/svg+xml'
  throw new ImportFailure('unsupported_media', 'encode')
}

export async function prepareMedia(
  blob: Blob,
  signal: AbortSignal,
): Promise<PreparedMedia> {
  signal.throwIfAborted()
  const mime = await detectMediaType(blob)
  const original = new Blob([blob], { type: mime })
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', await original.arrayBuffer()),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  if (mime.startsWith('image/'))
    return {
      original,
      hash,
      kind: 'image',
      ...(await createImagePreview(original, signal)),
    }
  if (mime.startsWith('video/'))
    return {
      original,
      hash,
      kind: 'video',
      ...(await createVideoPoster(original, signal)),
    }
  throw new ImportFailure('unsupported_media', 'encode')
}
