
import { Edit, FileLock2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'
import type { UserT } from '@/features/auth/types'

function getUserRoleLabel(user: UserT): string | null {
  const primaryRole = user.userRoles?.[0]
  if (!primaryRole) return null
  return primaryRole.role.name || primaryRole.roleId
}

interface UserTableProps {
  users?: Array<UserT> | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  onEdit: (user: UserT) => void
  onDelete: (user: UserT) => void
  onDeactivate: (user: UserT) => void
}

export function UserTable({
  users,
  isLoading,
  isError,
  error,
  onEdit,
  onDelete,
  onDeactivate,
}: UserTableProps) {
  const { t } = useTranslation('user')

  if (isLoading) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {t('status.loading')}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="w-full rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        {error?.message || t('status.error')}
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('table.columns.name')}</th>
              <th className="px-4 py-3 font-medium">{t('table.columns.email')}</th>
              <th className="px-4 py-3 font-medium">{t('table.columns.role')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('table.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {t('table.emptyMessage')}
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const roleLabel = getUserRoleLabel(user)
                return (
                  <tr key={user.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{user.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-normal">
                        {roleLabel ?? t('table.roleUnknown')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(user)}
                          title={t('actions.edit')}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onDeactivate(user)}
                          title={t('actions.deactivate')}
                        >
                          <FileLock2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onDelete(user)}
                          title={t('actions.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </div>
    </div>
  )
}
