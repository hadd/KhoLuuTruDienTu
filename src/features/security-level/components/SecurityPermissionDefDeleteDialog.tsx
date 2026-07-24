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
import { useDeleteSecurityPermissionDef } from '@/features/security-level/queries'
import type { SecurityPermissionDefT } from '@/features/security-level/types'

interface SecurityPermissionDefDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  permissionDef: SecurityPermissionDefT | null
}

export function SecurityPermissionDefDeleteDialog({
  open,
  onOpenChange,
  permissionDef,
}: SecurityPermissionDefDeleteDialogProps) {
  const { t } = useTranslation('security-level')
  const deleteDef = useDeleteSecurityPermissionDef()

  if (!permissionDef) return null

  const handleDelete = () => {
    if (permissionDef.isSystem) {
      toast.error(t('permissions.delete.systemBlocked'))
      return
    }
    deleteDef.mutate(permissionDef.id, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('permissions.delete.confirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('permissions.delete.confirmDescription', {
              name: permissionDef.name,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDef.isPending}>
            {t('permissions.delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteDef.isPending || permissionDef.isSystem}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteDef.isPending
              ? t('permissions.delete.deleting')
              : t('permissions.delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
