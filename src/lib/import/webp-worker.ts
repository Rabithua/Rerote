import { encodeWebP } from './webp-codec'
import { ImportFailure } from './types'

self.onmessage = async (
  event: MessageEvent<{
    pixels: ArrayBuffer
    width: number
    height: number
    quality: number
    codecUrl: string
  }>,
) => {
  try {
    const { pixels, width, height, quality, codecUrl } = event.data
    const image = new ImageData(new Uint8ClampedArray(pixels), width, height)
    const encoded = await encodeWebP(image, quality, codecUrl)
    const buffer = await encoded.arrayBuffer()
    self.postMessage({ buffer }, { transfer: [buffer] })
  } catch (error) {
    self.postMessage({
      error: error instanceof ImportFailure ? error.code : 'webp_encode_failed',
    })
  }
}
