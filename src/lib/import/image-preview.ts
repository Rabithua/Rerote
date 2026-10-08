import { createPreviewEncoder } from './webp-worker-client'
import { ImportFailure } from './types'

export const WEBP_ATTEMPTS = [
  [1600, 80],
  [1600, 65],
  [1200, 65],
  [900, 55],
  [600, 45],
] as const
export const MAX_PREVIEW_BYTES = 512 * 1024

export async function createImagePreview(original: Blob, signal: AbortSignal) {
  signal.throwIfAborted()
  let image: ImageBitmap
  try {
    image = await createImageBitmap(original, {
      imageOrientation: 'from-image',
      colorSpaceConversion: 'default',
      premultiplyAlpha: 'none',
    })
  } catch {
    throw new ImportFailure('image_decode_failed', 'encode')
  }
  const encoder = createPreviewEncoder(signal)
  try {
    for (const [dimension, quality] of WEBP_ATTEMPTS) {
      signal.throwIfAborted()
      const scale = Math.min(1, dimension / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale)),
        height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', {
        colorSpace: 'srgb',
        willReadFrequently: true,
      })
      if (!context) throw new ImportFailure('image_decode_failed', 'encode')
      context.clearRect(0, 0, width, height)
      context.drawImage(image, 0, 0, width, height)
      // Canvas getImageData returns straight RGBA, converted to sRGB, preserving alpha.
      const preview = await encoder.encode(
        context.getImageData(0, 0, width, height, { colorSpace: 'srgb' }),
        quality,
      )
      signal.throwIfAborted()
      if (preview.type === 'image/webp' && preview.size <= MAX_PREVIEW_BYTES)
        return { preview, width, height }
    }
    throw new ImportFailure('preview_limit_exceeded', 'encode')
  } finally {
    image.close()
    encoder.close()
  }
}
