import { useQuery } from '@tanstack/react-query'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  getDigitalSignHistory,
  getDigitalSignStatus,
  verifyDigitalSignature,
} from '@/features/digital-sign/api/digitalSignClient'

export function digitalSignStatusQueryOptions(dossierId: string) {
  return {
    queryKey: ['digital-sign', 'status', dossierId] as const,
    queryFn: () => getDigitalSignStatus(dossierId),
  }
}

export function digitalSignHistoryQueryOptions(dossierId: string) {
  return {
    queryKey: ['digital-sign', 'history', dossierId] as const,
    queryFn: () => getDigitalSignHistory(dossierId),
  }
}

export function DigitalSignHistorySection({
  dossierId,
}: {
  dossierId: string
}) {
  const { t } = useTranslation('data-management')
  const [verifyingFileId, setVerifyingFileId] = useState<string | null>(null)

  const statusQuery = useQuery(digitalSignStatusQueryOptions(dossierId))
  const historyQuery = useQuery(digitalSignHistoryQueryOptions(dossierId))

  if (statusQuery.isLoading || historyQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('digitalSign.loadingHistory')}
      </div>
    )
  }

  const status = statusQuery.data
  const history = historyQuery.data ?? []

  if (!status || (status.totalFiles === 0 && history.length === 0)) {
    return null
  }

  async function handleVerify(fileId: string) {
    setVerifyingFileId(fileId)
    try {
      const result = await verifyDigitalSignature(fileId)
      if (result.valid) {
        toast.success(t('digitalSign.verifySuccess'))
      } else {
        toast.error(result.reason ?? t('digitalSign.verifyFailed'))
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('digitalSign.verifyFailed'),
      )
    } finally {
      setVerifyingFileId(null)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('digitalSign.historyTitle')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('digitalSign.historySummary', {
            signed: status.signedFiles,
            total: status.totalFiles,
          })}
        </p>
      </div>

      <ul className="space-y-3">
        {history.map((entry) => {
          const file = status.files.find((item) => item.id === entry.fileId)
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-muted/40 p-3 text-sm"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{file?.fileName ?? entry.fileId}</p>
                <p className="text-muted-foreground">{entry.certificateSubject}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.signerName ?? t('digitalSign.unknownSigner')} ·{' '}
                  {new Date(entry.signedAt).toLocaleString()}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={verifyingFileId === entry.fileId}
                onClick={() => void handleVerify(entry.fileId)}
              >
                {verifyingFileId === entry.fileId ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldCheck className="mr-2 size-4" aria-hidden />
                )}
                {t('digitalSign.verify')}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
