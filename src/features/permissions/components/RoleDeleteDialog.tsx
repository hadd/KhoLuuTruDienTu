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
import { useDeleteAdminRole } from '@/features/permissions/queries'
import type { PermissionRoleT } from '@/features/permissions/types'
import { getRoleLabel } from '@/features/user/lib/roleLabels'

interface RoleDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: PermissionRoleT | null
  onBeforeDelete?: (roleId: string) => void
}

export function RoleDeleteDialog({
  open,
  onOpenChange,
  role,
  onBeforeDelete,
}: RoleDeleteDialogProps) {
  const { t } = useTranslation('permissions')
  const deleteRole = useDeleteAdminRole()

  if (!role) return null

  const roleLabel = getRoleLabel(role.id, role.name) ?? role.name

  const handleDelete = () => {
    onBeforeDelete?.(role.id)
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('roles.delete.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('roles.delete.confirmDescription', { name: roleLabel })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteRole.isPending}>
            {t('roles.delete.cancelButton')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              handleDelete()
            }}
            disabled={deleteRole.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteRole.isPending
              ? t('roles.delete.deleting')
              : t('roles.delete.confirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
