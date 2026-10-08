import { ImportFailure } from './types'

export async function createVideoPoster(original: Blob, signal: AbortSignal) {
  const url = URL.createObjectURL(original)
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.playsInline = true
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        video.onloadeddata = null
        video.onerror = null
        error ? reject(error) : resolve()
      }
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'))
      const timer = setTimeout(
        () => finish(new ImportFailure('video_decode_failed', 'encode')),
        30000,
      )
      video.onloadeddata = () => finish()
      video.onerror = () =>
        finish(new ImportFailure('video_decode_failed', 'encode'))
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      else video.src = url
    })
    signal.throwIfAborted()
    const scale = Math.min(
      1,
      1600 / Math.max(video.videoWidth, video.videoHeight),
    )
    const width = Math.max(1, Math.round(video.videoWidth * scale)),
      height = Math.max(1, Math.round(video.videoHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { colorSpace: 'srgb' })
    if (!context) throw new ImportFailure('video_decode_failed', 'encode')
    context.drawImage(video, 0, 0, width, height)
    const poster = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob?.type === 'image/jpeg'
            ? resolve(blob)
            : reject(new ImportFailure('video_decode_failed', 'encode')),
        'image/jpeg',
        0.8,
      ),
    )
    return { poster, width, height }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
