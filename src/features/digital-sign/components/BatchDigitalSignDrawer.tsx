import { Loader2, Pause, PenLine, Play, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildBatchDossierQueue,
  runDigitalSignQueue,
  summarizeQueue,
  type DigitalSignQueueItem,
} from '@/features/digital-sign/lib/signingRunner'
import {
  detectCaAdapter,
  getCaInstallGuideUrl,
  type CaCertificate,
} from '@/lib/ca-sign/ca-adapter'

export function BatchDigitalSignDrawer({
  open,
  onOpenChange,
  dossierIds,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierIds: Array<string>
  onCompleted?: () => void
}) {
  const { t } = useTranslation('data-management')
  const adapter = useMemo(() => detectCaAdapter(), [open])
  const [certificates, setCertificates] = useState<Array<CaCertificate>>([])
  const [selectedThumbprint, setSelectedThumbprint] = useState('')
  const [loadingCerts, setLoadingCerts] = useState(false)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const [queue, setQueue] = useState<Array<DigitalSignQueueItem>>([])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!open) {
      setQueue([])
      setSelectedThumbprint('')
      setCertificates([])
      setPaused(false)
      return
    }

    let cancelled = false

    async function loadQueue() {
      try {
        const items = await buildBatchDossierQueue(dossierIds)
        if (!cancelled) {
          setQueue(items)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : t('digitalSign.prepareError'),
          )
        }
      }
    }

    void loadQueue()
    return () => {
      cancelled = true
    }
  }, [dossierIds, open, t])

  const loadCertificates = useCallback(async () => {
    if (!adapter) return
    setLoadingCerts(true)
    try {
      const certs = await adapter.listCertificates()
      setCertificates(certs)
      if (certs[0]) {
        setSelectedThumbprint(certs[0].thumbprint)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('digitalSign.certLoadError'),
      )
    } finally {
      setLoadingCerts(false)
    }
  }, [adapter, t])

  useEffect(() => {
    if (open && adapter) {
      void loadCertificates()
    }
  }, [adapter, loadCertificates, open])

  const selectedCertificate = certificates.find(
    (cert) => cert.thumbprint === selectedThumbprint,
  )
  const progress = summarizeQueue(queue)

  async function handleSign() {
    if (!adapter || !selectedCertificate) return
    if (!queue.length) {
      toast.info(t('digitalSign.noPendingFiles'))
      return
    }

    setRunning(true)
    setPaused(false)
    try {
      const finalItems = await runDigitalSignQueue({
        items: queue,
        adapter,
        certificate: selectedCertificate,
        shouldStop: () => pausedRef.current,
        onUpdate: setQueue,
      })

      const latest = summarizeQueue(finalItems)
      if (latest.completed > 0) {
        onCompleted?.()
      }
      if (latest.failed === 0 && latest.completed > 0) {
        toast.success(t('digitalSign.completed'))
      } else if (latest.completed > 0) {
        toast.warning(t('digitalSign.partialCompleted'))
      } else if (!pausedRef.current) {
        toast.error(t('digitalSign.failed'))
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PenLine className="size-5" aria-hidden />
            {t('digitalSign.batchTitle')}
          </SheetTitle>
          <SheetDescription>
            {t('digitalSign.batchDescription', { count: dossierIds.length })}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden py-2">
          {!adapter ? (
            <div className="space-y-3 rounded-md border border-dashed border-border p-4 text-sm">
              <p>{t('digitalSign.pluginMissing')}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={getCaInstallGuideUrl('vnpt')} target="_blank" rel="noreferrer">
                    VNPT-CA
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={getCaInstallGuideUrl('viettel')} target="_blank" rel="noreferrer">
                    Viettel-CA
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={getCaInstallGuideUrl('bkav')} target="_blank" rel="noreferrer">
                    BKAV-CA
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t('digitalSign.selectCertificate')}</Label>
                <Select
                  value={selectedThumbprint}
                  onValueChange={setSelectedThumbprint}
                  disabled={loadingCerts || running}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('digitalSign.selectCertificate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {certificates.map((cert) => (
                      <SelectItem key={cert.thumbprint} value={cert.thumbprint}>
                        {cert.subject || cert.thumbprint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {queue.map((item) => (
                    <li key={item.fileId} className="space-y-1 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {item.fileName}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {t(`digitalSign.queueStatus.${item.status}`, {
                            defaultValue: item.status,
                          })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.dossierName}
                      </p>
                      {item.error ? (
                        <p className="text-xs text-destructive">{item.error}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                {t('digitalSign.progressSummary', {
                  completed: progress.completed,
                  total: progress.total,
                  failed: progress.failed,
                })}
              </p>
            </>
          )}
        </div>

        <SheetFooter className="gap-2 sm:flex-row sm:justify-end">
          {running ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaused(true)}
            >
              <Pause className="mr-2 size-4" aria-hidden />
              {t('digitalSign.pause')}
            </Button>
          ) : paused ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPaused(false)
                void handleSign()
              }}
            >
              <Play className="mr-2 size-4" aria-hidden />
              {t('digitalSign.resume')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={running}
          >
            {t('digitalSign.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSign()}
            disabled={!adapter || !selectedCertificate || running || !queue.length}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t('digitalSign.signing')}
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 size-4" aria-hidden />
                {t('digitalSign.confirm')}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
