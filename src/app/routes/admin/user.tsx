import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getAllUsers } from '@/features/user/api/userClient'

import { UserTable } from '@/features/user/components/ManageUser' 
import type { UserT } from '@/features/user/types'
import i18n from '@/lib/i18n/config'

// 1. Cấu hình Route cho TanStack
export const Route = createFileRoute('/admin/user')({
  head: () => ({
   meta: [{ 
  title: `${i18n.t('pageTitles.user', { ns: 'common' })} - ${i18n.t('appName', { ns: 'common' })}` 
}]
  }),
  component: ManageUserRoute,
})


function ManageUserRoute() {
  const { t } = useTranslation('common')
  
  
  const { data: users, isLoading, isError, error } = useQuery<Array<UserT>>({
    queryKey: ['users'],
    queryFn: getAllUsers,
  })

  // Layout tổng
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t('userListTitle', 'Danh sách người dùng')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('userListDesc', 'Quản lý tất cả người dùng trong hệ thống.')}
          </p>
        </div>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          {t('addUser', 'Thêm mới')}
        </Button>
      </div>

      {/* Đẩy data xuống cho Component giao diện */}
      <UserTable 
        users={users} 
        isLoading={isLoading} 
        isError={isError} 
        error={error} 
      />
    </div>
  )
}