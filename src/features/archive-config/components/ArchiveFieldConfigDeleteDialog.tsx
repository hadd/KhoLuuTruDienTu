import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { useDeleteArchiveFieldConfigMutation } from '@/features/archive-config/queries'
import type { ArchiveFieldConfigT } from '@/features/archive-config/types'
import { translateError } from '@/lib/utils/translate-error'

interface ArchiveFieldConfigDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: ArchiveFieldConfigT | null
  onDeleted?: () => void
}

export function ArchiveFieldConfigDeleteDialog({
  open,
  onOpenChange,
  field,
  onDeleted,
}: ArchiveFieldConfigDeleteDialogProps) {
  const { t } = useTranslation('archive-config')
  const deleteMutation = useDeleteArchiveFieldConfigMutation()

  if (!field) return null

  function handleDelete() {
    if (!field) return

    deleteMutation.mutate(field.id, {
      onSuccess: () => {
        onOpenChange(false)
        onDeleted?.()
      },
      onError: (error) => {
        toast.error(translateError(error))
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('delete.confirmDescription', { name: field.label })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
