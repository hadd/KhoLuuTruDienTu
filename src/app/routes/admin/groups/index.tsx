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
export const Route = createFileRoute('/admin/groups/')({
    head: () => ({
        meta: [{
            title: `TODO`
        }]
    }),
    component: ManageGroupRoute,
})


function ManageGroupRoute() {
    const { t } = useTranslation('common')


    // Layout tổng
    return (
        <div>TODO</div>
    )
}