import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { countUploadBatchStats } from '@/features/document-scan/lib/scanTreeUtils'
import { useUploadScanBatchMutation } from '@/features/document-scan/queries'
import type { ScanWorkspaceT } from '@/features/document-scan/types'
import { Upload } from 'lucide-react'
import { useMemo, useState } from 'react'

interface ScanUploadToolbarProps {
  workspace: ScanWorkspaceT
  checkedIds: Array<string>
  onUploaded?: () => void
}

export function ScanUploadToolbar({
  workspace,
  checkedIds,
  onUploaded,
}: ScanUploadToolbarProps) {
  const { t } = useTranslation('document-scan')
  const uploadBatch = useUploadScanBatchMutation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const stats = useMemo(
    () => countUploadBatchStats(workspace, checkedIds),
    [workspace, checkedIds],
  )

  const disabled = checkedIds.length === 0 || uploadBatch.isPending

  const handleUpload = async () => {
    await uploadBatch.mutateAsync(checkedIds)
    setConfirmOpen(false)
    onUploaded?.()
  }

  return (
    <>
      <div className="space-y-2 border-b border-border p-3">
        <Button
          type="button"
          className="w-full gap-2"
          disabled={disabled}
          onClick={() => setConfirmOpen(true)}
        >
          <Upload className="size-4" />
          {uploadBatch.isPending ? t('upload.uploading') : t('upload.title')}
        </Button>
        {checkedIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('upload.disabledHint')}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('upload.summary', {
              nodeCount: checkedIds.length,
              documentCount: stats.documentCount,
              pageCount: stats.pageCount,
            })}
          </p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('upload.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('upload.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploadBatch.isPending}>
              {t('upload.cancelButton')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={uploadBatch.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleUpload()
              }}
            >
              {uploadBatch.isPending
                ? t('upload.uploading')
                : t('upload.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
