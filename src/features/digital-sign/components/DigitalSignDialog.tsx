import { Loader2, PenLine, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildSingleDossierQueue,
  runDigitalSignQueue,
  summarizeQueue,
  type DigitalSignQueueItem,
} from '@/features/digital-sign/lib/signingRunner'
import {
  detectCaAdapter,
  detectCaAdapterAsync,
  getCaInstallGuideUrl,
  type CaAdapter,
  type CaCertificate,
} from '@/lib/ca-sign/ca-adapter'

function QueueProgress({
  items,
}: {
  items: Array<DigitalSignQueueItem>
}) {
  const { t } = useTranslation('data-management')

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('digitalSign.noPendingFiles')}
      </p>
    )
  }

  return (
    <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
      {items.map((item) => (
        <li
          key={item.fileId}
          className="flex items-center justify-between gap-3 text-sm"
        >
          <span className="min-w-0 truncate">{item.fileName}</span>
          <span className="shrink-0 text-muted-foreground">
            {t(`digitalSign.queueStatus.${item.status}`, {
              defaultValue: item.status,
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function DigitalSignDialog({
  open,
  onOpenChange,
  dossierId,
  dossierName,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierId: string
  dossierName?: string
  onCompleted?: () => void
}) {
  const { t } = useTranslation('data-management')
  const [activeAdapters, setActiveAdapters] = useState<Array<CaAdapter>>([])
  const [certificates, setCertificates] = useState<Array<CaCertificate>>([])
  const [selectedThumbprint, setSelectedThumbprint] = useState<string>('')
  const [loadingCerts, setLoadingCerts] = useState(false)
  const [running, setRunning] = useState(false)
  const [queue, setQueue] = useState<Array<DigitalSignQueueItem>>([])

  useEffect(() => {
    if (!open) {
      setActiveAdapters([])
      setQueue([])
      setSelectedThumbprint('')
      setCertificates([])
      return
    }

    let cancelled = false

    async function initAdapterAndQueue() {
      const adapters = await detectAllActiveCaAdapters()
      if (!cancelled) {
        setActiveAdapters(adapters)
      }
      try {
        const items = await buildSingleDossierQueue(dossierId)
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

    void initAdapterAndQueue()
    return () => {
      cancelled = true
    }
  }, [dossierId, open, t])

  const loadCertificates = useCallback(async () => {
    if (!activeAdapters.length) return
    setLoadingCerts(true)
    try {
      const allCerts: Array<CaCertificate> = []
      for (const adp of activeAdapters) {
        try {
          const certs = await adp.listCertificates()
          certs.forEach((c) => {
            allCerts.push({ ...c, providerId: adp.providerId })
          })
        } catch {
          // Continue trying next adapter
        }
      }
      setCertificates(allCerts)
      if (allCerts[0]) {
        setSelectedThumbprint(allCerts[0].thumbprint)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('digitalSign.certLoadError'),
      )
    } finally {
      setLoadingCerts(false)
    }
  }, [activeAdapters, t])

  useEffect(() => {
    if (open && activeAdapters.length > 0) {
      void loadCertificates()
    }
  }, [activeAdapters, loadCertificates, open])

  const selectedCertificate = certificates.find(
    (cert) => cert.thumbprint === selectedThumbprint,
  )

  const progress = summarizeQueue(queue)

  async function handleSign() {
    if (!selectedCertificate) return
    const targetAdapter = activeAdapters.find(
      (a) => a.providerId === selectedCertificate.providerId,
    ) ?? activeAdapters[0]

    if (!targetAdapter) return
    if (!queue.length) {
      toast.info(t('digitalSign.noPendingFiles'))
      return
    }

    setRunning(true)
    try {
      const finalItems = await runDigitalSignQueue({
        items: queue,
        adapter: targetAdapter,
        certificate: selectedCertificate,
        onUpdate: setQueue,
      })

      const summary = summarizeQueue(finalItems)
      if (summary.failed === 0 && summary.completed > 0) {
        toast.success(t('digitalSign.completed'))
        onCompleted?.()
        onOpenChange(false)
      } else if (summary.completed > 0) {
        toast.warning(t('digitalSign.partialCompleted'))
        onCompleted?.()
      } else {
        toast.error(t('digitalSign.failed'))
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-5" aria-hidden />
            {t('digitalSign.title')}
          </DialogTitle>
          <DialogDescription>
            {dossierName
              ? t('digitalSign.descriptionWithName', { name: dossierName })
              : t('digitalSign.description')}
          </DialogDescription>
        </DialogHeader>

        {!activeAdapters.length ? (
          <div className="space-y-3 rounded-md border border-dashed border-border p-4 text-sm">
            <p>{t('digitalSign.pluginMissing')}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" onClick={() => setActiveAdapters([ca2CaAdapter])}>
                Kết nối CA2 USB Token
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
                      [{cert.providerId?.toUpperCase()}] {cert.subject || cert.thumbprint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <QueueProgress items={queue} />

            <p className="text-xs text-muted-foreground">
              {t('digitalSign.progressSummary', {
                completed: progress.completed,
                total: progress.total,
                failed: progress.failed,
              })}
            </p>
          </div>
        )}

        <DialogFooter>
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
            disabled={!activeAdapters.length || !selectedCertificate || running || !queue.length}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
