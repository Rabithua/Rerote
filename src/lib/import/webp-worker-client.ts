import { ImportFailure } from './types'

export function createPreviewEncoder(signal: AbortSignal) {
  const worker = new Worker(new URL('./webp-worker.ts', import.meta.url), {
    type: 'module',
  })
  return {
    encode(image: ImageData, quality: number): Promise<Blob> {
      return new Promise((resolve, reject) => {
        const abort = () => {
          worker.terminate()
          finish(new DOMException('Cancelled', 'AbortError'))
        }
        const finish = (error?: Error, buffer?: ArrayBuffer) => {
          signal.removeEventListener('abort', abort)
          worker.onmessage = null
          worker.onerror = null
          error
            ? reject(error)
            : resolve(new Blob([buffer!], { type: 'image/webp' }))
        }
        worker.onmessage = (
          event: MessageEvent<{
            error?: string
            buffer?: ArrayBuffer
          }>,
        ) =>
          event.data.error
            ? finish(new ImportFailure(event.data.error, 'encode'))
            : finish(undefined, event.data.buffer)
        worker.onerror = () =>
          finish(new ImportFailure('webp_encode_failed', 'encode'))
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
        else
          worker.postMessage(
            {
              pixels: image.data.buffer,
              width: image.width,
              height: image.height,
              quality,
              // Workers loaded through blob URLs need an absolute codec fetch URL.
              codecUrl: new URL('/codecs/webp-1.6.0.wasm', window.location.href)
                .href,
            },
            [image.data.buffer],
          )
      })
    },
    close: () => worker.terminate(),
  }
}
