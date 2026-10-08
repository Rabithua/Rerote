import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RoteClient } from '@/lib/import/rote-client'
import { importErrorText } from '@/lib/import/messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface TargetConnectionProps {
  client: RoteClient | null
  onConnect: (client: RoteClient | null) => void
  busy: boolean
}

export function TargetConnection({
  client,
  onConnect,
  busy,
}: TargetConnectionProps) {
  const { t } = useTranslation()
  const [instanceUrl, setInstanceUrl] = useState('')
  const [openKey, setOpenKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const handleConnect = useCallback(async () => {
    const abort = new AbortController()
    controller.current = abort
    setConnecting(true)
    setError('')
    try {
      const connected = await RoteClient.connect(
        instanceUrl,
        openKey,
        abort.signal,
      )
      setOpenKey('')
      onConnect(connected)
    } catch (failure) {
      if (!abort.signal.aborted)
        setError(
          importErrorText(
            failure instanceof Error ? failure.message : 'connection_failed',
            t,
          ),
        )
    } finally {
      setConnecting(false)
    }
  }, [instanceUrl, openKey, onConnect, t])
  const handleDisconnect = useCallback(() => {
    onConnect(null)
    setOpenKey('')
    setError('')
  }, [onConnect])
  return (
    <section className="flex flex-col gap-3" aria-labelledby="target-heading">
      <div
        role="heading"
        aria-level={2}
        id="target-heading"
        className="text-lg font-semibold"
      >
        {t('direct.connectTitle')}
      </div>
      {client ? (
        <>
          <div className="text-sm">
            {client.info.owner.nickname || client.info.owner.username} ·{' '}
            {client.info.owner.username}
          </div>
          <div className="text-xs text-muted-foreground break-all">
            {client.baseUrl} · {t('direct.connected')}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('direct.permissionsSummary', {
              images: t(
                client.info.capabilities.attachments
                  ? 'direct.allowed'
                  : 'direct.unavailable',
              ),
              video: t(
                client.info.capabilities.video
                  ? 'direct.allowed'
                  : 'direct.unavailable',
              ),
              overwrite: t(
                client.info.capabilities.overwrite
                  ? 'direct.allowed'
                  : 'direct.unavailable',
              ),
            })}
          </div>
          <Button
            variant="outline"
            className="self-start"
            onClick={handleDisconnect}
            disabled={busy}
          >
            {t('direct.disconnect')}
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="rote-instance">{t('direct.instanceUrl')}</Label>
              <Input
                id="rote-instance"
                type="url"
                value={instanceUrl}
                onChange={(event) => setInstanceUrl(event.target.value)}
                placeholder="https://api.rote.ink"
                disabled={connecting || busy}
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="rote-openkey">OpenKey</Label>
              <Input
                id="rote-openkey"
                type="password"
                autoComplete="off"
                value={openKey}
                onChange={(event) => setOpenKey(event.target.value)}
                disabled={connecting || busy}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {t('direct.keyHint')}
          </div>
          <Button
            className="self-start"
            disabled={!instanceUrl || !openKey || connecting || busy}
            onClick={handleConnect}
          >
            {t(connecting ? 'direct.connecting' : 'direct.connect')}
          </Button>
        </>
      )}
      {error ? (
        <div role="alert" className="text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}
    </section>
  )
}
