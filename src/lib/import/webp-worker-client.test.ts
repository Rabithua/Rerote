// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { createPreviewEncoder } from './webp-worker-client'

afterEach(() => vi.unstubAllGlobals())
test('provides an absolute codec URL to bundled or blob-based workers', async () => {
  const worker = {
    onmessage: null as
      | ((event: { data: { buffer: ArrayBuffer } }) => void)
      | null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
  vi.stubGlobal(
    'Worker',
    vi.fn(function () {
      return worker
    }),
  )
  const pixels = new Uint8ClampedArray(16)
  const encoder = createPreviewEncoder(new AbortController().signal)
  const encoded = encoder.encode(
    { data: pixels, width: 2, height: 2 } as ImageData,
    80,
  )
  expect(worker.postMessage).toHaveBeenCalledWith(
    {
      pixels: pixels.buffer,
      width: 2,
      height: 2,
      quality: 80,
      codecUrl: new URL('/codecs/webp-1.6.0.wasm', window.location.href).href,
    },
    [pixels.buffer],
  )
  worker.onmessage!({ data: { buffer: new ArrayBuffer(12) } })
  expect((await encoded).type).toBe('image/webp')
  encoder.close()
  expect(worker.terminate).toHaveBeenCalled()
})
test('cancellation terminates the encoder and rejects the pending work', async () => {
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
  vi.stubGlobal(
    'Worker',
    vi.fn(function () {
      return worker
    }),
  )
  const controller = new AbortController()
  const encoder = createPreviewEncoder(controller.signal)
  const encoded = encoder.encode(
    { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData,
    80,
  )
  controller.abort()
  await expect(encoded).rejects.toThrow('Cancelled')
  expect(worker.terminate).toHaveBeenCalled()
})
