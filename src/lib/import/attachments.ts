import { prepareMedia } from './media'
import { ImportFailure } from './types'
import type {
  ImportApi,
  ImportStage,
  PreparedMedia,
  UploadDestination,
} from './types'
import type { RoteAttachment } from '../converters/types'

export interface SourceCredentials {
  baseUrl: string
  token: string
}
export interface AttachmentResources {
  ids: Array<string>
  reservations: Array<string>
}

export async function putMedia(
  destination: UploadDestination | undefined,
  blob: Blob,
  signal: AbortSignal,
) {
  if (!destination || destination.contentType !== blob.type)
    throw new ImportFailure('upload_manifest_mismatch', 'upload')
  const response = await fetch(destination.putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
    signal,
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok)
    throw new ImportFailure(`upload_http_${response.status}`, 'upload')
}

export async function uploadAttachment(
  api: ImportApi,
  attachment: RoteAttachment,
  index: number,
  signal: AbortSignal,
  resources: AttachmentResources,
  onStage: (stage: ImportStage) => void,
  sourceCredentials?: SourceCredentials,
  mediaEncoder: typeof prepareMedia = prepareMedia,
) {
  let stage: ImportStage = 'download'
  try {
    signal.throwIfAborted()
    if (!api.info.capabilities.attachments)
      throw new ImportFailure('attachment_permission_required')
    const url = new URL(attachment.url)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new ImportFailure('invalid_attachment_url')
    const headers: Record<string, string> = {}
    if (sourceCredentials && attachment.source?.provider === 'memos') {
      const source = new URL(sourceCredentials.baseUrl)
      const prefix = source.pathname.replace(/\/$/, '')
      if (
        url.origin === source.origin &&
        (url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))
      )
        headers.Authorization = `Bearer ${sourceCredentials.token}`
    }
    onStage(stage)
    const response = await fetch(url, {
      headers,
      signal,
      credentials: 'omit',
      redirect: Object.keys(headers).length ? 'error' : 'follow',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok)
      throw new ImportFailure(`download_http_${response.status}`)
    const blob = await response.blob()
    stage = 'encode'
    onStage(stage)
    const media: PreparedMedia = await mediaEncoder(blob, signal)
    const caps = api.info.capabilities
    if (media.kind === 'video' && !caps.video)
      throw new ImportFailure('video_permission_required')
    const types =
      media.kind === 'image' ? caps.imageMimeTypes : caps.videoMimeTypes
    const max = media.kind === 'image' ? caps.maxImageBytes : caps.maxVideoBytes
    if (!types.includes(media.original.type))
      throw new ImportFailure('unsupported_media')
    if (media.original.size > max)
      throw new ImportFailure('attachment_size_exceeded')
    stage = 'upload'
    onStage(stage)
    const presigned = await api.presign(media, signal)
    if (presigned.reservationId)
      resources.reservations.push(presigned.reservationId)
    const ticket = presigned.items.at(0)
    if (!ticket) throw new ImportFailure('upload_manifest_mismatch')
    await putMedia(ticket.original, media.original, signal)
    if (media.preview) await putMedia(ticket.compressed, media.preview, signal)
    if (media.poster) await putMedia(ticket.poster, media.poster, signal)
    stage = 'finalize'
    onStage(stage)
    signal.throwIfAborted()
    // Finalize has a bounded, independent signal so cancellation can discover and clean its idempotent result.
    const finalized = await api.finalize(
      {
        uuid: ticket.uuid,
        originalKey: ticket.original.key,
        compressedKey: media.preview ? ticket.compressed?.key : undefined,
        posterKey: media.poster ? ticket.poster?.key : undefined,
        size: media.original.size,
        mimetype: media.original.type,
        width: media.width,
        height: media.height,
        mediaKind: media.kind,
        hash: media.hash,
      },
      presigned.reservationId,
      AbortSignal.timeout(30000),
    )
    if (finalized.length !== 1 || !finalized[0].id)
      throw new ImportFailure('finalize_invalid_result')
    resources.ids.push(finalized[0].id)
    signal.throwIfAborted()
    return { ...finalized[0], sortIndex: index, source: attachment.source }
  } catch (error) {
    if (signal.aborted) throw error
    throw new ImportFailure(
      error instanceof ImportFailure
        ? error.code
        : 'attachment_network_or_cors',
      stage,
      index,
    )
  }
}

export async function cleanupResources(
  api: ImportApi,
  resources: AttachmentResources,
): Promise<boolean> {
  let complete = true
  for (const id of [...resources.reservations]) {
    try {
      await api.cancelReservation(id)
      resources.reservations.splice(resources.reservations.indexOf(id), 1)
    } catch {
      complete = false
    }
  }
  for (let offset = resources.ids.length; offset > 0; offset -= 100) {
    const ids = resources.ids.slice(Math.max(0, offset - 100), offset)
    try {
      await api.cleanup(ids)
      resources.ids.splice(Math.max(0, offset - 100), ids.length)
    } catch {
      complete = false
    }
  }
  return complete
}
