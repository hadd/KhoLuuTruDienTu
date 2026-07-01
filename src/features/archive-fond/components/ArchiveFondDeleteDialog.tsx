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
import { useDeleteArchiveFond } from '@/features/archive-fond/queries'
import type { ArchiveFondT } from '@/features/archive-fond/types'

interface ArchiveFondDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fond: ArchiveFondT | null
}

export function ArchiveFondDeleteDialog({
  open,
  onOpenChange,
  fond,
}: ArchiveFondDeleteDialogProps) {
  const { t } = useTranslation('archive-fond')
  const deleteFond = useDeleteArchiveFond()

  if (!fond) return null

  const handleDelete = () => {
    deleteFond.mutate(fond.id, {
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
            {t('delete.confirmDescription', { name: fond.fondName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteFond.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteFond.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteFond.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
