import { ImportFailure } from './types'

interface WebPExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory
  malloc: (size: number) => number
  free: (pointer: number) => void
  WebPFree: (pointer: number) => void
  WebPEncodeRGBA: (
    pixels: number,
    width: number,
    height: number,
    stride: number,
    quality: number,
    output: number,
  ) => number
  WebPGetEncoderVersion: () => number
  _initialize: () => void
}
let codec: Promise<WebPExports> | undefined
async function loadCodec(codecUrl: string): Promise<WebPExports> {
  codec ??= (async () => {
    const response = await fetch(codecUrl, {
      credentials: 'omit',
    })
    if (!response.ok) throw new ImportFailure('webp_encoder_unavailable')
    const { instance } = await WebAssembly.instantiate(
      await response.arrayBuffer(),
      {
        env: { emscripten_notify_memory_growth: () => {} },
        wasi_snapshot_preview1: {
          fd_close: () => 0,
          fd_write: () => 8,
          fd_seek: () => 8,
          proc_exit: () => {
            throw new ImportFailure('webp_encode_failed')
          },
        },
      },
    )
    const exports = instance.exports as WebPExports
    exports._initialize()
    if (exports.WebPGetEncoderVersion() !== 0x010600)
      throw new ImportFailure('webp_encoder_version')
    return exports
  })()
  return codec
}

export async function encodeWebP(
  image: ImageData,
  quality: number,
  codecUrl: string,
): Promise<Blob> {
  const wasm = await loadCodec(codecUrl)
  const pixels = wasm.malloc(image.data.byteLength)
  const output = wasm.malloc(4)
  if (!pixels || !output) {
    if (pixels) wasm.free(pixels)
    if (output) wasm.free(output)
    throw new ImportFailure('webp_encode_failed')
  }
  let encoded = 0
  try {
    new Uint8Array(wasm.memory.buffer, pixels, image.data.byteLength).set(
      image.data,
    )
    const size = wasm.WebPEncodeRGBA(
      pixels,
      image.width,
      image.height,
      image.width * 4,
      quality,
      output,
    )
    encoded = new DataView(wasm.memory.buffer).getUint32(output, true)
    if (!size || !encoded) throw new ImportFailure('webp_encode_failed')
    const bytes = new Uint8Array(wasm.memory.buffer, encoded, size).slice()
    if (
      String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP'
    )
      throw new ImportFailure('webp_encode_failed')
    return new Blob([bytes], { type: 'image/webp' })
  } finally {
    if (encoded) wasm.WebPFree(encoded)
    wasm.free(output)
    wasm.free(pixels)
  }
}
