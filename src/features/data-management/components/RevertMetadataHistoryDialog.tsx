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
import type { DataMetadataEditBatchT } from '@/features/data-management/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'

export function RevertMetadataHistoryDialog({
  open,
  onOpenChange,
  batch,
  onConfirm,
  isConfirming,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  batch: DataMetadataEditBatchT | null
  onConfirm: () => void | Promise<void>
  isConfirming?: boolean
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')
  const language = useCurrentLanguage()

  if (!batch) return null

  const editorName =
    batch.editorName.trim() || t('recordDetail.editHistory.systemActor')
  const editedAtLabel = formatDate(batch.editedAt, 'PPp', language)
  const versionLabel =
    batch.versionNumber != null
      ? t('recordDetail.editHistory.versionLabelWithNumber', {
          version: batch.versionNumber,
        })
      : editedAtLabel

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('recordDetail.editHistory.revertConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('recordDetail.editHistory.revertConfirmDescription', {
              editor: editorName,
              version: versionLabel,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>
            {tCommon('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isConfirming}
            onClick={(e) => {
              e.preventDefault()
              void onConfirm()
            }}
          >
            {t('recordDetail.editHistory.revertConfirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
