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
import { useDeleteDocumentType } from '@/features/document-type/queries'
import type { DocumentTypeT } from '@/features/document-type/types'

interface DocumentTypeDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentType: DocumentTypeT | null
}

export function DocumentTypeDeleteDialog({
  open,
  onOpenChange,
  documentType,
}: DocumentTypeDeleteDialogProps) {
  const { t } = useTranslation('document-type')
  const deleteDocumentType = useDeleteDocumentType()

  if (!documentType) return null

  const handleDelete = () => {
    deleteDocumentType.mutate(documentType.id, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.confirmDescription', { name: documentType.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDocumentType.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteDocumentType.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteDocumentType.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
