import { Link } from '@tanstack/react-router'
import { Shield, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  userTabsListClassName,
  userTabsTriggerCompactClassName,
} from '@/features/user/components/UserManagementBackNav'
import { usePermissionManagementAccess } from '@/features/user/hooks/usePermissionManagementAccess'
import { useUserAccess } from '@/features/user/hooks/useUserAccess'
import { cn } from '@/lib/utils/cn'

export type UserManagementSectionTabT = 'users' | 'permissions'

type UserManagementSectionTabItem = {
  id: UserManagementSectionTabT
  to: '/app/users' | '/app/permissions/function-matrix'
  label: string
  icon: LucideIcon
}

export function useUserManagementSectionTabs(): Array<UserManagementSectionTabItem> {
  const { t } = useTranslation('user-management')
  const { canViewUsers } = useUserAccess()
  const { canViewPermissions } = usePermissionManagementAccess()

  return useMemo(() => {
    const items: Array<UserManagementSectionTabItem> = []

    if (canViewUsers) {
      items.push({
        id: 'users',
        to: '/app/users',
        label: t('sectionTabs.users'),
        icon: Users,
      })
    }
    if (canViewPermissions) {
      items.push({
        id: 'permissions',
        to: '/app/permissions/function-matrix',
        label: t('sectionTabs.permissions'),
        icon: Shield,
      })
    }

    return items
  }, [canViewUsers, canViewPermissions, t])
}

export function UserManagementSectionTabs({
  active,
}: {
  active: UserManagementSectionTabT
  compact?: boolean
}) {
  const tabs = useUserManagementSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  return (
    <nav
      className={cn(userTabsListClassName, 'shrink-0')}
      aria-label="User management sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active

        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(userTabsTriggerCompactClassName, 'inline-flex items-center')}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
