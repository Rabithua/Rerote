// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { MAX_PREVIEW_BYTES, createImagePreview } from './image-preview'

const encoder = vi.hoisted(() => ({ encode: vi.fn(), close: vi.fn() }))
vi.mock('./webp-worker-client', () => ({ createPreviewEncoder: () => encoder }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
function canvas() {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 2400, height: 1800, close: vi.fn() }),
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement) {
      return {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: () => ({
          width: this.width,
          height: this.height,
          data: new Uint8ClampedArray(4),
        }),
      } as unknown as CanvasRenderingContext2D
    },
  )
}
test('uses the required ladder and stops at the first qualifying WebP', async () => {
  canvas()
  encoder.encode
    .mockResolvedValueOnce(
      new Blob([new Uint8Array(MAX_PREVIEW_BYTES + 1)], { type: 'image/webp' }),
    )
    .mockResolvedValueOnce(new Blob(['webp'], { type: 'image/webp' }))
  const result = await createImagePreview(
    new Blob(),
    new AbortController().signal,
  )
  expect(result).toMatchObject({ width: 1600, height: 1200 })
  expect(
    encoder.encode.mock.calls.map(([pixels, quality]) => [
      pixels.width,
      pixels.height,
      quality,
    ]),
  ).toEqual([
    [1600, 1200, 80],
    [1600, 1200, 65],
  ])
  expect(encoder.close).toHaveBeenCalled()
})
test('reports failure after every attempt and never substitutes PNG', async () => {
  canvas()
  encoder.encode.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
  await expect(
    createImagePreview(new Blob(), new AbortController().signal),
  ).rejects.toThrow('preview_limit_exceeded')
  expect(
    encoder.encode.mock.calls.map(([pixels, quality]) => [
      pixels.width,
      quality,
    ]),
  ).toEqual([
    [1600, 80],
    [1600, 65],
    [1200, 65],
    [900, 55],
    [600, 45],
  ])
  expect(encoder.close).toHaveBeenCalled()
})
