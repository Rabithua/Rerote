import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConversionResult } from '@/lib/converters/types'
import type {
  AttachmentResources,
  SourceCredentials,
} from '@/lib/import/attachments'
import type { RoteClient } from '@/lib/import/rote-client'
import type { ImportProgress, NoteImportResult } from '@/lib/import/types'
import { cleanupResources } from '@/lib/import/attachments'
import { executeImport } from '@/lib/import/executor'
import { importErrorText } from '@/lib/import/messages'
import { downloadJSON } from '@/lib/utils/file'
import { NotePreview } from '@/components/import/NotePreview'
import { Button } from '@/components/ui/button'

interface DirectImportProps {
  result: ConversionResult
  client: RoteClient | null
  preserveVisibility: boolean
  sourceCredentials?: SourceCredentials
  onBusyChange: (busy: boolean) => void
}

export function DirectImport({
  result,
  client,
  preserveVisibility,
  sourceCredentials,
  onBusyChange,
}: DirectImportProps) {
  const { t } = useTranslation()
  const data = result.data!
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(data.notes.map((note) => note.id)),
  )
  const [overwrite, setOverwrite] = useState(false)
  const [running, setRunning] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [results, setResults] = useState<Map<string, NoteImportResult>>(
    () => new Map(),
  )
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const resources = useRef(new Map<string, AttachmentResources>())
  useEffect(
    () => () => {
      controller.current?.abort()
      if (client)
        for (const tracked of resources.current.values())
          void cleanupResources(client, tracked)
    },
    [client],
  )
  const handleToggle = useCallback(
    (id: string) =>
      setSelectedIds((current) => {
        const next = new Set(current)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      }),
    [],
  )
  const handleSelectAll = useCallback(
    (all: boolean) =>
      setSelectedIds(new Set(all ? data.notes.map((note) => note.id) : [])),
    [data.notes],
  )
  const handleResult = useCallback(
    (value: NoteImportResult) =>
      setResults((current) => new Map(current).set(value.noteId, value)),
    [],
  )
  const handleRun = useCallback(
    async (retry: boolean) => {
      if (!client) return
      const ids = retry
        ? new Set(
            [...results.values()]
              .filter(
                (item) =>
                  item.status === 'failed' ||
                  item.status === 'cancelled' ||
                  item.cleanupPending,
              )
              .map((item) => item.noteId),
          )
        : selectedIds
      const abort = new AbortController()
      controller.current = abort
      setRunning(true)
      setCancelling(false)
      onBusyChange(true)
      setError('')
      if (!retry) setResults(new Map())
      try {
        await executeImport({
          api: client,
          data,
          selectedIds: ids,
          existingStrategy: overwrite ? 'overwrite' : 'skip',
          preserveVisibility,
          signal: abort.signal,
          onProgress: setProgress,
          onResult: handleResult,
          sourceCredentials,
          resources: resources.current,
        })
      } catch (failure) {
        if (!abort.signal.aborted)
          setError(
            importErrorText(
              failure instanceof Error ? failure.message : 'import_failed',
              t,
            ),
          )
      } finally {
        setRunning(false)
        setCancelling(false)
        onBusyChange(false)
      }
    },
    [
      client,
      data,
      results,
      selectedIds,
      overwrite,
      preserveVisibility,
      handleResult,
      sourceCredentials,
      onBusyChange,
      t,
    ],
  )
  const handleImport = useCallback(() => void handleRun(false), [handleRun])
  const handleRetry = useCallback(() => void handleRun(true), [handleRun])
  const handleCancel = useCallback(() => {
    setCancelling(true)
    controller.current?.abort()
  }, [])
  const handleDownload = useCallback(
    () =>
      downloadJSON(
        data,
        `rote-backup-${new Date().toISOString().slice(0, 10)}.json`,
      ),
    [data],
  )
  const outcomes = [...results.values()]
  const retryable = outcomes.some(
    (item) =>
      item.status === 'failed' ||
      item.status === 'cancelled' ||
      item.cleanupPending,
  )
  return (
    <section className="flex flex-col gap-4" aria-labelledby="preview-heading">
      <div
        role="heading"
        aria-level={2}
        id="preview-heading"
        className="text-lg font-semibold"
      >
        {t('direct.previewTitle')}
      </div>
      <div className="text-sm text-muted-foreground">
        {t(preserveVisibility ? 'direct.preserveHint' : 'direct.privateHint')}
      </div>
      {result.stats.skipped ? (
        <div className="text-sm text-muted-foreground">
          {t('direct.blankSkipped', { count: result.stats.skipped })}
        </div>
      ) : null}
      {result.errors.length || result.warnings.length ? (
        <details className="text-sm text-muted-foreground">
          <summary>
            {t('converter.errorDetails')} · {result.stats.failed}
          </summary>
          <ul>
            {[...result.errors, ...result.warnings].map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <NotePreview
        notes={data.notes}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
        disabled={running}
      />
      <label className="flex gap-2 items-center text-sm">
        <input
          type="checkbox"
          className="accent-gray-500"
          checked={overwrite}
          onChange={(event) => setOverwrite(event.target.checked)}
          disabled={running || !client?.info.capabilities.overwrite}
        />
        {t('direct.overwrite')}
      </label>
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={handleImport}
          disabled={!client || running || selectedIds.size === 0}
        >
          {t('direct.import')}
        </Button>
        <Button variant="outline" onClick={handleDownload} disabled={running}>
          {t('direct.backup')}
        </Button>
        {running ? (
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {t(cancelling ? 'direct.cancelling' : 'direct.cancel')}
          </Button>
        ) : null}
        {retryable ? (
          <Button
            variant="outline"
            onClick={handleRetry}
            disabled={running || !client}
          >
            {t('direct.retry')}
          </Button>
        ) : null}
      </div>
      {!client ? (
        <div className="text-sm text-muted-foreground">
          {t('direct.connectFirst')}
        </div>
      ) : null}
      {progress ? (
        <div role="status" className="flex flex-col gap-2">
          <div className="text-sm">
            {t(`direct.stages.${progress.stage}`)} · {progress.completed} /{' '}
            {progress.total}
          </div>
          <progress
            aria-label={t('direct.progress')}
            value={progress.completed}
            max={Math.max(1, progress.total)}
            className="w-full h-2 appearance-none overflow-hidden rounded bg-muted [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-gray-500 [&::-moz-progress-bar]:bg-gray-500"
          />
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}
      {outcomes.length ? (
        <div className="flex flex-col gap-2">
          <div className="text-sm" role="status">
            {t('direct.summary', {
              success: outcomes.filter((item) =>
                ['created', 'updated'].includes(item.status),
              ).length,
              skipped: outcomes.filter((item) => item.status === 'skipped')
                .length,
              failed: outcomes.filter((item) =>
                ['failed', 'cancelled'].includes(item.status),
              ).length,
            })}
          </div>
          <details>
            <summary className="cursor-pointer text-sm">
              {t('direct.resultDetails')}
            </summary>
            <ul className="flex flex-col gap-2 py-2">
              {outcomes.map((item) => (
                <li
                  key={item.noteId}
                  className="text-xs text-muted-foreground break-words"
                >
                  {t(`direct.statuses.${item.status}`)} · {item.title}{' '}
                  {item.error ? `· ${importErrorText(item.error, t)}` : ''}{' '}
                  {item.stage ? `· ${t(`direct.stages.${item.stage}`)}` : ''}{' '}
                  {item.attachmentIndex !== undefined
                    ? `· ${t('direct.attachmentNumber', { count: item.attachmentIndex + 1 })}`
                    : ''}{' '}
                  {item.cleanupPending
                    ? `· ${t('direct.errors.cleanup_pending')}`
                    : ''}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  )
}
