import type { RoteArticle, RoteAttachment, RoteNote } from '../converters/types'

export interface ImportCapabilities {
  formalImport: number
  sourceIdentity: boolean
  historicalCreatedAt: boolean
  bindUnboundAttachments: boolean
  batchSize: number
  attachments: boolean
  video: boolean
  overwrite: boolean
  articles: boolean
  cleanupUnbound: boolean
  browserDirectUpload: boolean
  imageMimeTypes: Array<string>
  videoMimeTypes: Array<string>
  maxImageBytes: number
  maxVideoBytes: number
  maxAttachments: number
}
export interface InstanceInfo {
  protocolVersion: number
  owner: { id: string; username: string; nickname: string | null }
  permissions: Array<string>
  capabilities: ImportCapabilities
}
export interface ImportPayload {
  formatVersion: 2
  notes: Array<RoteNote>
  articles: Array<RoteArticle>
  importOptions: {
    existingStrategy: 'skip' | 'overwrite'
    visibilityStrategy: 'private' | 'preserve'
  }
}
export interface ImportCommitResult {
  results: Array<{
    index: number
    id: string
    status: 'created' | 'updated' | 'skipped'
  }>
}
export interface UploadDestination {
  key: string
  putUrl: string
  contentType: string
}
export interface UploadTicket {
  uuid: string
  original: UploadDestination
  compressed?: UploadDestination
  poster?: UploadDestination
}
export interface PresignResult {
  items: Array<UploadTicket>
  reservationId?: string
}
export interface FinalizeInput {
  uuid: string
  originalKey: string
  compressedKey?: string
  posterKey?: string
  size: number
  mimetype: string
  width: number
  height: number
  mediaKind: 'image' | 'video'
  hash: string
}
export type ImportStage =
  | 'plan'
  | 'download'
  | 'encode'
  | 'upload'
  | 'finalize'
  | 'commit'
  | 'cleanup'
export type ImportStatus =
  | 'created'
  | 'updated'
  | 'skipped'
  | 'failed'
  | 'cancelled'
export interface NoteImportResult {
  noteId: string
  title: string
  status: ImportStatus
  targetId?: string
  stage?: ImportStage
  error?: string
  attachmentIndex?: number
  cleanupPending?: boolean
}
export interface ImportProgress {
  completed: number
  total: number
  stage: ImportStage
  noteId?: string
}
export interface PreparedMedia {
  original: Blob
  preview?: Blob
  poster?: Blob
  width: number
  height: number
  hash: string
  kind: 'image' | 'video'
}
export interface ImportApi {
  info: InstanceInfo
  plan: (
    payload: ImportPayload,
    signal: AbortSignal,
  ) => Promise<{ noteIndexes: Array<number> }>
  commit: (
    payload: ImportPayload,
    signal: AbortSignal,
  ) => Promise<ImportCommitResult>
  presign: (media: PreparedMedia, signal: AbortSignal) => Promise<PresignResult>
  finalize: (
    input: FinalizeInput,
    reservationId: string | undefined,
    signal: AbortSignal,
  ) => Promise<Array<RoteAttachment>>
  cleanup: (ids: Array<string>) => Promise<void>
  cancelReservation: (id: string) => Promise<void>
}
export class ImportFailure extends Error {
  constructor(
    public code: string,
    public stage?: ImportStage,
    public attachmentIndex?: number,
  ) {
    super(code)
    this.name = 'ImportFailure'
  }
}
