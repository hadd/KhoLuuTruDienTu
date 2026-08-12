import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PdfViewer } from '@/components/common/PdfViewer'
import { Button } from '@/components/ui/button'
import type { DisposalDocumentPreviewTargetT } from '@/features/archive-disposal/components/DisposalCatalogItemsTable'
import { getArchiveWarehouseFileContent } from '@/features/archive-warehouse/api/archiveWarehouseClient'
import { archiveWarehouseDossierDetailQueryOptions } from '@/features/archive-warehouse/queries'
import type { ArchiveWarehouseDossierFileT } from '@/features/archive-warehouse/types'
import { resolveOcrPdfUrlFromFile } from '@/features/data-management/lib/metadataHelpers'
import {
  verifyFileAccess,
  verifySecurityLevelAccess,
} from '@/features/security-level/api/securityLevelClient'
import { SecurityAccessPasswordDialog } from '@/features/security-level/components/SecurityAccessPasswordDialog'
import {
  rememberDossierUnlockedFile,
  rememberDossierUnlockedSecurityLevel,
  setFileAccessToken,
  setSecurityLevelAccessToken,
} from '@/features/security-level/lib/securityAccessTokenStore'
import { translateError } from '@/lib/utils/translate-error'

type DisposalDocumentPreviewPanelProps = {
  target: DisposalDocumentPreviewTargetT | null
  onClose: () => void
}

export function DisposalDocumentPreviewPanel({
  target,
  onClose,
}: DisposalDocumentPreviewPanelProps) {
  const { t } = useTranslation('archive-disposal')
  const { t: tSecurity } = useTranslation('security-level')
  const queryClient = useQueryClient()

  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [lockedFile, setLockedFile] = useState<ArchiveWarehouseDossierFileT | null>(
    null,
  )

  const dossierId = target?.dossierId ?? ''
  const fileId = target?.fileId ?? ''

  const { data: dossierDetail, isPending: isDossierPending } = useQuery({
    ...archiveWarehouseDossierDetailQueryOptions(dossierId),
    enabled: Boolean(target),
  })

  const file = useMemo(
    () => dossierDetail?.files.find((entry) => entry.id === fileId) ?? null,
    [dossierDetail?.files, fileId],
  )

  const loadPdfUrl = useCallback(async () => {
    if (!target || !file) return
    setContentError(null)
    setIsLoadingContent(true)
    try {
      const ocrUrl = resolveOcrPdfUrlFromFile(
        file as unknown as Record<string, unknown>,
      )
      if (ocrUrl) {
        setPdfUrl(ocrUrl)
        return
      }
      if (file.fileUrl) {
        setPdfUrl(file.fileUrl)
        return
      }
      const content = await getArchiveWarehouseFileContent(
        target.dossierId,
        target.fileId,
        { disposition: 'inline', variant: 'searchable' },
      )
      setPdfUrl(content.url)
    } catch (error) {
      setContentError(translateError(error))
      setPdfUrl(null)
    } finally {
      setIsLoadingContent(false)
    }
  }, [file, target])

  useEffect(() => {
    if (!target) {
      setPdfUrl(null)
      setContentError(null)
      setPasswordDialogOpen(false)
      setLockedFile(null)
      return
    }
    if (isDossierPending) return
    if (!file) {
      setContentError(t('proposal.previewFileNotFound'))
      return
    }
    if (file.accessLocked) {
      setLockedFile(file)
      setPasswordDialogOpen(true)
      setPdfUrl(null)
      return
    }
    void loadPdfUrl()
  }, [target, file, isDossierPending, loadPdfUrl, t])

  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      if (!lockedFile || !target) {
        throw new Error(tSecurity('access.unlockFailed'))
      }
      if (lockedFile.requiredFilePassword) {
        const result = await verifyFileAccess({
          securityLevelId: lockedFile.requiredSecurityLevelId ?? undefined,
          fileId: lockedFile.id,
          password,
        })
        setFileAccessToken(
          'warehouse',
          lockedFile.id,
          result.token,
          result.expiresIn,
        )
        rememberDossierUnlockedFile('warehouse', target.dossierId, lockedFile.id)
      } else {
        if (!lockedFile.requiredSecurityLevelId) {
          throw new Error(tSecurity('access.unlockFailed'))
        }
        const result = await verifySecurityLevelAccess({
          securityLevelId: lockedFile.requiredSecurityLevelId,
          password,
        })
        setSecurityLevelAccessToken(
          'warehouse',
          lockedFile.requiredSecurityLevelId,
          result.token,
          result.expiresIn,
        )
        rememberDossierUnlockedSecurityLevel(
          'warehouse',
          target.dossierId,
          lockedFile.requiredSecurityLevelId,
        )
      }
      await queryClient.fetchQuery(
        archiveWarehouseDossierDetailQueryOptions(target.dossierId),
      )
    },
    onSuccess: () => {
      setPasswordDialogOpen(false)
      toast.success(tSecurity('access.unlockSuccess'))
      void loadPdfUrl()
    },
    onError: (error) => {
      toast.error(translateError(error) || tSecurity('access.unlockFailed'))
    },
  })

  if (!target) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-background shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-label={t('proposal.previewDocument')}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <p className="truncate text-sm font-medium">{target.fileName}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t('proposal.previewClose')}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="min-h-[320px] flex-1 overflow-auto p-2">
            {isDossierPending || isLoadingContent ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="sr-only">{t('proposal.previewLoading')}</span>
              </div>
            ) : contentError ? (
              <p className="p-4 text-sm text-destructive">{contentError}</p>
            ) : pdfUrl ? (
              <PdfViewer
                fileUrl={pdfUrl}
                fileName={target.fileName}
                fitEdge
                className="min-h-[70vh]"
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                {t('proposal.previewLoading')}
              </p>
            )}
          </div>
        </div>
      </div>

      <SecurityAccessPasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        title={
          lockedFile?.requiredFilePassword
            ? tSecurity('access.fileTitle')
            : tSecurity('access.levelTitle')
        }
        description={
          lockedFile?.requiredFilePassword
            ? tSecurity('access.fileDescription')
            : tSecurity('access.levelDescription')
        }
        isPending={unlockMutation.isPending}
        onSubmit={async (password) => {
          await unlockMutation.mutateAsync(password)
        }}
      />
    </>
  )
}
