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
import { useDeleteDossierType } from '@/features/dossier-type/queries'
import type { DossierTypeT } from '@/features/dossier-type/types'

interface DossierTypeDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dossierType: DossierTypeT | null
}

export function DossierTypeDeleteDialog({
  open,
  onOpenChange,
  dossierType,
}: DossierTypeDeleteDialogProps) {
  const { t } = useTranslation('dossier-type')
  const deleteDossierType = useDeleteDossierType()

  if (!dossierType) return null

  const handleDelete = () => {
    deleteDossierType.mutate(dossierType.id, {
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
            {t('delete.confirmDescription', { name: dossierType.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDossierType.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteDossierType.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteDossierType.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
