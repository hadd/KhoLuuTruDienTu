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
import type { ScanBranchNodeType } from '@/features/document-scan/types'

interface ScanDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeType: ScanBranchNodeType
  nodeName: string
  onConfirm: () => void
  isLoading?: boolean
}

export function ScanDeleteDialog({
  open,
  onOpenChange,
  nodeType,
  nodeName,
  onConfirm,
  isLoading = false,
}: ScanDeleteDialogProps) {
  const { t } = useTranslation('document-scan')

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('delete.confirmTitle', { type: t(`nodeTypes.${nodeType}`) })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.confirmDescription', { name: nodeName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
