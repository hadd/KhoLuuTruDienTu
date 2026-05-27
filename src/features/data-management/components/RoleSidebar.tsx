import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  roleSidebarNavItems
} from '@/features/data-management/config/sidebarConfig'

import type { RoleSidebarNavItem } from '@/features/data-management/config/sidebarConfig'
import { cn } from '@/lib/utils/cn'

export function RoleSidebar({
  role,
  className,
  collapsed = false,
  onToggleCollapse,
}: {
  role: Exclude<DataManagementRole, 'admin'>
  className?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { t } = useTranslation('data-management')
  const navItems = roleSidebarNavItems[role]

  return (
    <div
      className={cn(
        'flex h-full w-full shrink-0 flex-col',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-border py-[0.875rem]',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        {!collapsed && <AppLogo className="h-7 sm:h-8" />}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted',
            !onToggleCollapse && 'pointer-events-none opacity-50',
          )}
          aria-label="Toggle Sidebar"
        >
          <Menu className="size-4" />
        </button>
      </div>
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 overflow-y-auto py-3',
          collapsed ? 'px-2' : 'px-3',
        )}
      >
        {navItems.map((item) => (
          <RoleNavLink key={item.to} item={item} label={t(item.labelKey)} collapsed={collapsed} />
        ))}
      </nav>
      <div className="mt-auto shrink-0 border-t border-border p-3">
        <UserAccountMenu collapsed={collapsed} />
      </div>
    </div>
  )
}

function RoleNavLink({
  item,
  label,
  collapsed,
}: {
  item: RoleSidebarNavItem
  label: string
  collapsed?: boolean
}) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      className="block"
      activeProps={{
        className: '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
      }}
      inactiveProps={{
        className: '[&>div]:hover:bg-muted/80',
      }}
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-foreground transition-colors',
            !isActive && 'text-muted-foreground',
            collapsed && 'justify-center px-2',
          )}
        >
          <Icon className="size-4 shrink-0" />
          {!collapsed && <span className="overflow-hidden whitespace-nowrap">{label}</span>}
        </div>
      )}
    </Link>
  )
}
