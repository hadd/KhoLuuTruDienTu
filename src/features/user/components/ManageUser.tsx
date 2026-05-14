import { useNavigate } from '@tanstack/react-router'
import { Edit, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Table } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { UserT } from '@/features/user/types'

interface UserTableProps {
  users?: Array<UserT> | null
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export const UserTable = ({ users, isLoading, isError, error }: UserTableProps) => {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground rounded-md border border-border bg-card">
        {t('loading', 'Đang tải dữ liệu...')}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-destructive rounded-md border border-destructive/20 bg-destructive/10">
        {error?.message || t('error', 'Đã xảy ra lỗi khi tải danh sách người dùng.')}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t('name', 'Họ và tên')}</th>
              <th className="px-4 py-3 font-medium">{t('email', 'Email')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('actions', 'Thao tác')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!users || users.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  {t('noData', 'Chưa có người dùng nào')}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{user.firstName} {user.lastName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {/* Thêm 'as any' tạm thời nếu chưa tạo route edit */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate({ to: `/users/${user.id}/edit` as any })}
                        title={t('edit', 'Sửa')}
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title={t('delete', 'Xóa')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </div>
  )
}