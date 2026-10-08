import { ImportFailure } from './types'
import type {
  FinalizeInput,
  ImportApi,
  ImportCommitResult,
  ImportPayload,
  InstanceInfo,
  PreparedMedia,
  PresignResult,
} from './types'
import type { RoteAttachment } from '../converters/types'

export function normalizeInstanceUrl(value: string): string {
  const url = new URL(value.trim())
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ImportFailure('invalid_instance_url')
  url.pathname = url.pathname.replace(/\/(?:v2\/api(?:\/openkey)?)?\/?$/, '')
  return url.href.replace(/\/$/, '')
}

export class RoteClient implements ImportApi {
  info!: InstanceInfo
  private constructor(
    readonly baseUrl: string,
    private readonly openKey: string,
  ) {}

  static async connect(
    instanceUrl: string,
    openKey: string,
    signal: AbortSignal,
  ): Promise<RoteClient> {
    const client = new RoteClient(
      normalizeInstanceUrl(instanceUrl),
      openKey.trim(),
    )
    const info = await client.request<Partial<InstanceInfo>>(
      '/imports/connect',
      {},
      AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    )
    const caps = info.capabilities
    if (
      info.protocolVersion !== 1 ||
      !caps ||
      caps.formalImport !== 2 ||
      !caps.sourceIdentity ||
      !caps.historicalCreatedAt ||
      !caps.bindUnboundAttachments ||
      !caps.cleanupUnbound ||
      !caps.browserDirectUpload ||
      !Number.isInteger(caps.batchSize) ||
      caps.batchSize < 50 ||
      !Number.isInteger(caps.maxAttachments) ||
      caps.maxAttachments < 1 ||
      ![caps.maxImageBytes, caps.maxVideoBytes].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      ![caps.imageMimeTypes, caps.videoMimeTypes].every(
        (value) =>
          Array.isArray(value) &&
          value.every((item) => typeof item === 'string'),
      ) ||
      ![caps.attachments, caps.video, caps.overwrite, caps.articles].every(
        (value) => typeof value === 'boolean',
      ) ||
      !info.owner?.id ||
      typeof info.owner.username !== 'string' ||
      !Array.isArray(info.permissions) ||
      !['GETROTE', 'SENDROTE'].every((permission) =>
        info.permissions?.includes(permission),
      )
    )
      throw new ImportFailure('instance_upgrade_required')
    client.info = info as InstanceInfo
    return client
  }

  private async request<T>(
    path: string,
    data: unknown,
    signal?: AbortSignal,
    method = 'POST',
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/v2/api/openkey${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.openKey}`,
          'Content-Type': 'application/json',
        },
        ...(method === 'POST' ? { body: JSON.stringify(data) } : {}),
        signal,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new ImportFailure('network_or_cors')
    }
    if (response.status === 404 && path === '/imports/connect')
      throw new ImportFailure('instance_upgrade_required')
    const body = (await response.json().catch(() => null)) as {
      code?: number
      message?: string
      data?: T
    } | null
    if (!response.ok || !body || body.code !== 0 || body.data === undefined) {
      const message =
        typeof body?.message === 'string'
          ? body.message.replaceAll(this.openKey, '[redacted]').slice(0, 200)
          : `http_${response.status}`
      throw new ImportFailure(message)
    }
    return body.data
  }

  plan(payload: ImportPayload, signal: AbortSignal) {
    return this.request<{ noteIndexes: Array<number> }>(
      '/imports/plan',
      payload,
      signal,
    )
  }
  commit(payload: ImportPayload, signal: AbortSignal) {
    return this.request<ImportCommitResult>('/imports', payload, signal)
  }
  presign(media: PreparedMedia, signal: AbortSignal) {
    return this.request<PresignResult>(
      '/attachments/presign',
      {
        browserDirectUpload: true,
        files: [
          {
            filename: 'original',
            contentType: media.original.type,
            size: media.original.size,
            mediaKind: media.kind,
            ...(media.preview
              ? {
                  compressed: {
                    contentType: media.preview.type,
                    size: media.preview.size,
                  },
                }
              : {}),
            ...(media.poster
              ? {
                  poster: {
                    contentType: media.poster.type,
                    size: media.poster.size,
                  },
                }
              : {}),
          },
        ],
      },
      signal,
    )
  }
  finalize(
    input: FinalizeInput,
    reservationId: string | undefined,
    signal: AbortSignal,
  ) {
    return this.request<Array<RoteAttachment>>(
      '/attachments/finalize',
      { attachments: [input], reservationId },
      signal,
    )
  }
  async cleanup(ids: Array<string>) {
    if (ids.length)
      await this.request(
        '/imports/attachments/cleanup',
        { ids },
        AbortSignal.timeout(15000),
      )
  }
  async cancelReservation(id: string) {
    await this.request(
      `/imports/reservations/${id}`,
      undefined,
      AbortSignal.timeout(15000),
      'DELETE',
    )
  }
}
