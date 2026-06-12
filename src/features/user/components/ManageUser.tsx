
import { Edit, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import type { UserT } from '@/features/auth/types'
import { getRoleLabel } from '@/features/user/lib/roleLabels'
import { cn } from '@/lib/utils/cn'

function getUserRoleLabel(user: UserT): string | null {
  const primaryRole = user.userRoles?.[0]
  if (!primaryRole) return null
  return getRoleLabel(primaryRole.roleId, primaryRole.role?.name)
}

interface UserTableProps {
  users?: Array<UserT> | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  onEdit: (user: UserT) => void
  onDelete: (user: UserT) => void
  onDeactivate: (user: UserT) => void
  onBulkDelete: () => void
}

export function UserTable({
  users,
  isLoading,
  isError,
  error,
  selectedIds,
  onSelectedIdsChange,
  onEdit,
  onDelete,
  onDeactivate,
  onBulkDelete,
}: UserTableProps) {
  const { t } = useTranslation('user')

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {t('status.loading')}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        {error?.message || t('status.error')}
      </div>
    )
  }

  const visibleUsers = users ?? []
  const visibleUserIds = visibleUsers.map((user) => user.id)
  const selectedOnPageCount = visibleUserIds.filter((id) => selectedIds.has(id)).length
  const allOnPageSelected =
    visibleUsers.length > 0 && selectedOnPageCount === visibleUsers.length
  const someOnPageSelected = selectedOnPageCount > 0 && !allOnPageSelected
  const hasSelection = selectedIds.size > 0

  function toggleUserSelection(userId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(userId)
    } else {
      next.delete(userId)
    }
    onSelectedIdsChange(next)
  }

  function toggleSelectAllOnPage(checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      visibleUserIds.forEach((id) => next.add(id))
    } else {
      visibleUserIds.forEach((id) => next.delete(id))
    }
    onSelectedIdsChange(next)
  }

  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <Table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/50 text-muted-foreground [&_th]:bg-muted/50">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={(value) => toggleSelectAllOnPage(value === true)}
                  aria-label={t('table.selectAll')}
                  disabled={visibleUsers.length === 0}
                />
              </th>
              <th className="px-4 py-3 font-medium">{t('table.columns.name')}</th>
              <th className="px-4 py-3 font-medium">{t('table.columns.email')}</th>
              <th className="px-4 py-3 font-medium">{t('table.columns.role')}</th>
              <th className="px-4 py-3 text-right font-medium">
                {hasSelection ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={onBulkDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('actions.deleteSelected', { count: selectedIds.size })}
                  </Button>
                ) : (
                  t('table.columns.actions')
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t('table.emptyMessage')}
                </td>
              </tr>
            ) : (
              visibleUsers.map((user) => {
                const roleLabel = getUserRoleLabel(user)
                const isSelected = selectedIds.has(user.id)

                return (
                  <tr
                    key={user.id}
                    className={cn(
                      'transition-colors hover:bg-muted/50',
                      isSelected && 'bg-muted/50',
                    )}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(value) => toggleUserSelection(user.id, value === true)}
                        aria-label={t('table.selectUser', { name: user.fullName })}
                      />
                    </td>
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
                        <div
                          className="flex items-center justify-center px-2"
                          title={
                            user.active === true
                              ? t('actions.deactivate')
                              : t('actions.activate', 'Mở khóa tài khoản')
                          }
                        >
                          <Switch
                            checked={user.active === true}
                            onCheckedChange={() => onDeactivate(user)}
                          />
                        </div>
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
