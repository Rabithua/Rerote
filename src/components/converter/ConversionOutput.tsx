import { useCallback, useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConversionResult } from '@/lib/converters/types'
import type { SourceCredentials } from '@/lib/import/attachments'
import type { RoteClient } from '@/lib/import/rote-client'
import { downloadJSON } from '@/lib/utils/file'
import { DirectImport } from '@/components/import/DirectImport'
import { TargetConnection } from '@/components/import/TargetConnection'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ConversionOutputProps {
  result: ConversionResult
  busy: boolean
  preserveVisibility: boolean
  sourceCredentials?: SourceCredentials
  onBusyChange: (busy: boolean) => void
}

export function ConversionOutput({
  result,
  busy,
  preserveVisibility,
  sourceCredentials,
  onBusyChange,
}: ConversionOutputProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('export')
  const [client, setClient] = useState<RoteClient | null>(null)
  const handleModeChange = useCallback(
    (value: string) => {
      if (!busy) setMode(value)
    },
    [busy],
  )
  const handleDownload = useCallback(() => {
    if (!result.data) return
    downloadJSON(
      result.data,
      `rote-export-${new Date().toISOString().slice(0, 10)}.json`,
    )
  }, [result.data])

  return (
    <section className="flex flex-col gap-4" aria-labelledby="output-heading">
      <div
        role="heading"
        aria-level={2}
        id="output-heading"
        className="text-lg font-semibold"
      >
        {t('output.title')}
      </div>
      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="export" disabled={busy}>
            {t('output.export')}
          </TabsTrigger>
          <TabsTrigger value="direct" disabled={busy}>
            {t('output.direct')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="export" className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            {t('output.exportHint')}
          </div>
          <div className="flex gap-6">
            {(['total', 'converted', 'failed'] as const).map((stat, index) => (
              <div key={stat} className="flex flex-col gap-1">
                <div className="text-2xl font-bold tabular-nums">
                  {result.stats[stat]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t(
                    [
                      'converter.totalRecords',
                      'converter.successRecords',
                      'converter.failedRecords',
                    ][index],
                  )}
                </div>
              </div>
            ))}
          </div>
          {result.stats.skipped ? (
            <div className="text-sm text-muted-foreground">
              {t('direct.blankSkipped', { count: result.stats.skipped })}
            </div>
          ) : null}
          {result.errors.length || result.warnings.length ? (
            <details className="text-sm text-muted-foreground">
              <summary>{t('converter.errorDetails')}</summary>
              <ul className="list-disc pl-5">
                {[...result.errors, ...result.warnings].map(
                  (message, index) => (
                    <li key={index}>{message}</li>
                  ),
                )}
              </ul>
            </details>
          ) : null}
          <Button
            className="self-start"
            onClick={handleDownload}
            disabled={busy}
          >
            <Download className="size-4" />
            {t('output.download')}
          </Button>
        </TabsContent>
        <TabsContent value="direct" className="flex flex-col gap-6">
          <TargetConnection client={client} onConnect={setClient} busy={busy} />
          <DirectImport
            key={`${result.data!.notes[0].id}:${client?.info.owner.id ?? 'offline'}:${client?.baseUrl ?? ''}`}
            result={result}
            client={client}
            preserveVisibility={preserveVisibility}
            sourceCredentials={sourceCredentials}
            onBusyChange={onBusyChange}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
