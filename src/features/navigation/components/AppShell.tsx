import { useQuery } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppLogo } from '@/components/common/AppLogo'
import { UserAccountMenu } from '@/features/auth/components/UserAccountMenu'
import {
  canAccessAppScreen,
  getPermissionsFromUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import {
  APP_SCREENS,
  type AppScreen,
  type AppScreenTo,
} from '@/features/navigation/config/appNav'
import { cn } from '@/lib/utils/cn'

export function AppShell() {
  const { t } = useTranslation('common')
  const [collapsed, setCollapsed] = useState(false)
  const { data: user } = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(getAccessToken()),
  })
  const permissions = useMemo(() => getPermissionsFromUser(user), [user])
  const visibleNavItems = useMemo(
    () =>
      APP_SCREENS.filter((item) =>
        canAccessAppScreen(permissions, item.requiredPermission),
      ),
    [permissions],
  )

  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-background">
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-[4.5rem]' : 'w-56',
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
            onClick={() => setCollapsed(!collapsed)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
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
          {visibleNavItems.map((item) => (
            <AppNavLink
              key={item.to}
              item={item}
              label={t(item.labelKey)}
              collapsed={collapsed}
            />
          ))}
        </nav>
        <div className="mt-auto shrink-0 border-t border-border p-3">
          <UserAccountMenu collapsed={collapsed} />
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function AppNavLink({
  item,
  label,
  collapsed,
}: {
  item: AppScreen
  label: string
  collapsed?: boolean
}) {
  const Icon = item.icon

  return (
    <Link
      to={item.to as AppScreenTo}
      className="block"
      activeProps={{
        className:
          '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
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
          {!collapsed && (
            <span className="overflow-hidden whitespace-nowrap">{label}</span>
          )}
        </div>
      )}
    </Link>
  )
}
