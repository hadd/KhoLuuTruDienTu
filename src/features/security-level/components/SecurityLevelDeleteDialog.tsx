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
import { useDeleteSecurityLevel } from '@/features/security-level/queries'
import type { SecurityLevelT } from '@/features/security-level/types'

interface SecurityLevelDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  securityLevel: SecurityLevelT | null
}

export function SecurityLevelDeleteDialog({
  open,
  onOpenChange,
  securityLevel,
}: SecurityLevelDeleteDialogProps) {
  const { t } = useTranslation('security-level')
  const deleteSecurityLevel = useDeleteSecurityLevel()

  if (!securityLevel) return null

  const handleDelete = () => {
    deleteSecurityLevel.mutate(securityLevel.id, {
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
            {t('delete.confirmDescription', { name: securityLevel.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSecurityLevel.isPending}>
            {t('delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteSecurityLevel.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteSecurityLevel.isPending
              ? t('delete.deleting')
              : t('delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
