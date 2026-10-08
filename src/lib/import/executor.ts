import { dedupeNotesBySource } from '../converters/import-source'
import { cleanupResources, uploadAttachment } from './attachments'
import { ImportFailure } from './types'
import type { AttachmentResources, SourceCredentials } from './attachments'
import type { ConversionResult, RoteNote } from '../converters/types'
import type {
  ImportApi,
  ImportPayload,
  ImportProgress,
  ImportStage,
  NoteImportResult,
} from './types'

export interface ExecuteImportOptions {
  api: ImportApi
  data: NonNullable<ConversionResult['data']>
  selectedIds: Set<string>
  existingStrategy: 'skip' | 'overwrite'
  preserveVisibility: boolean
  signal: AbortSignal
  onProgress: (progress: ImportProgress) => void
  onResult: (result: NoteImportResult) => void
  sourceCredentials?: SourceCredentials
  resources: Map<string, AttachmentResources>
}

export async function executeImport(options: ExecuteImportOptions) {
  const { api, data, signal, resources } = options
  const notes = dedupeNotesBySource(
    data.notes.filter((note) => options.selectedIds.has(note.id)),
  )
  if (
    options.existingStrategy === 'overwrite' &&
    !api.info.capabilities.overwrite
  )
    throw new ImportFailure('overwrite_permission_required')
  let completed = 0
  const results = new Map<string, NoteImportResult>()
  const report = (
    note: RoteNote,
    result: Omit<NoteImportResult, 'noteId' | 'title'>,
  ) => {
    const value = {
      noteId: note.id,
      title: note.title || note.content.slice(0, 80),
      ...result,
    }
    results.set(note.id, value)
    options.onResult(value)
    completed++
    options.onProgress({
      completed,
      total: notes.length,
      stage: result.stage ?? 'commit',
      noteId: note.id,
    })
  }
  const payload = (
    batch: Array<RoteNote>,
    planning = false,
  ): ImportPayload => ({
    formatVersion: 2,
    notes: planning
      ? batch.map((note) => ({ ...note, attachments: [] }))
      : batch,
    articles: data.articles.filter((article) =>
      batch.some((note) => note.articleId === article.id),
    ),
    importOptions: {
      existingStrategy: options.existingStrategy,
      visibilityStrategy: options.preserveVisibility ? 'preserve' : 'private',
    },
  })
  const candidates: Array<RoteNote> = []
  try {
    // Plan all selected identities before downloading a single remote attachment.
    for (let offset = 0; offset < notes.length; offset += 50) {
      signal.throwIfAborted()
      const batch = notes.slice(offset, offset + 50)
      options.onProgress({ completed, total: notes.length, stage: 'plan' })
      try {
        const plan = await api.plan(payload(batch, true), signal)
        if (
          !Array.isArray(plan.noteIndexes) ||
          plan.noteIndexes.some(
            (index) =>
              !Number.isInteger(index) || index < 0 || index >= batch.length,
          )
        )
          throw new ImportFailure('invalid_import_plan')
        const wanted = new Set(plan.noteIndexes)
        batch.forEach((note, index) =>
          wanted.has(index)
            ? candidates.push(note)
            : report(note, { status: 'skipped', stage: 'plan' }),
        )
      } catch (error) {
        if (signal.aborted) throw error
        batch.forEach((note) =>
          report(note, {
            status: 'failed',
            stage: 'plan',
            error: error instanceof ImportFailure ? error.code : 'plan_failed',
          }),
        )
      }
    }
    for (let offset = 0; offset < candidates.length; offset += 50) {
      signal.throwIfAborted()
      const ready: Array<RoteNote> = []
      for (const note of candidates.slice(offset, offset + 50)) {
        signal.throwIfAborted()
        const tracked = resources.get(note.id) ?? { ids: [], reservations: [] }
        resources.set(note.id, tracked)
        let stage: ImportStage = 'cleanup'
        try {
          if (!(await cleanupResources(api, tracked)))
            throw new ImportFailure('cleanup_pending', 'cleanup')
          if (note.attachments.length > api.info.capabilities.maxAttachments)
            throw new ImportFailure('attachment_count_exceeded', 'encode')
          const uploaded = []
          for (const [index, attachment] of note.attachments.entries()) {
            uploaded.push(
              await uploadAttachment(
                api,
                attachment,
                index,
                signal,
                tracked,
                (value) => {
                  stage = value
                  options.onProgress({
                    completed,
                    total: notes.length,
                    stage,
                    noteId: note.id,
                  })
                },
                options.sourceCredentials,
              ),
            )
          }
          ready.push({ ...note, attachments: uploaded })
        } catch (error) {
          const cleaned = await cleanupResources(api, tracked)
          if (signal.aborted) throw error
          const failure =
            error instanceof ImportFailure
              ? error
              : new ImportFailure('attachment_failed', stage)
          report(note, {
            status: 'failed',
            stage: failure.stage ?? stage,
            error: failure.code,
            attachmentIndex: failure.attachmentIndex,
            cleanupPending: !cleaned,
          })
        }
      }
      if (!ready.length) continue
      signal.throwIfAborted()
      options.onProgress({ completed, total: notes.length, stage: 'commit' })
      try {
        const committed = await api.commit(payload(ready), signal)
        if (
          !Array.isArray(committed.results) ||
          committed.results.length !== ready.length ||
          new Set(committed.results.map((result) => result.index)).size !==
            ready.length ||
          committed.results.some(
            (result) =>
              result.index < 0 ||
              result.index >= ready.length ||
              !['created', 'updated', 'skipped'].includes(result.status),
          )
        )
          throw new ImportFailure('commit_result_unknown')
        committed.results.forEach((result) =>
          report(ready[result.index], {
            status: result.status,
            targetId: result.id,
          }),
        )
      } catch (error) {
        if (signal.aborted) throw error
        ready.forEach((note) =>
          report(note, {
            status: 'failed',
            stage: 'commit',
            error:
              error instanceof ImportFailure
                ? error.code
                : 'commit_result_unknown',
          }),
        )
      }
    }
  } finally {
    for (const note of notes) {
      const tracked = resources.get(note.id)
      const cleaned = tracked ? await cleanupResources(api, tracked) : true
      if (cleaned) resources.delete(note.id)
      const existing = results.get(note.id)
      if (!existing)
        report(note, {
          status: signal.aborted ? 'cancelled' : 'failed',
          error: signal.aborted
            ? 'cancelled_retry_to_confirm'
            : 'import_failed',
          cleanupPending: !cleaned,
        })
      else if (!cleaned) {
        const result = { ...existing, cleanupPending: true }
        results.set(note.id, result)
        options.onResult(result)
      }
    }
  }
}
