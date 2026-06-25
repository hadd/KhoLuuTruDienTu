import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Menu, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/common/AppHeader'
import { Button } from '@/components/ui/button'
import {
  getCurrentUserRoleId,
  getPrimaryAppRoleFromProfile,
  isAppScreenChildVisibleOnSidebar,
  isAppScreenVisibleOnSidebar,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import {
  APP_SCREENS,
  type AppScreen,
  type AppScreenChild,
  type AppScreenTo,
} from '@/features/navigation/config/appNav'
import {
  permissionsCatalogQueryOptions,
  rolePermissionsQueryOptions,
} from '@/features/permissions/queries'
import type { PermissionCatalogItemT } from '@/features/permissions/types'
import { cn } from '@/lib/utils/cn'

export function AppShell() {
  const { t } = useTranslation('common')
  const [collapsed, setCollapsed] = useState(false)
  const { data: user } = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(getAccessToken()),
  })
  const { data: catalog, isLoading: isCatalogLoading } = useQuery(
    permissionsCatalogQueryOptions(),
  )
  const currentRoleId = useMemo(() => getCurrentUserRoleId(user), [user])
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(currentRoleId ?? ''),
    enabled: Boolean(currentRoleId),
  })
  const permissions = useMemo(
    () =>
      resolvePermissionsForUser(user, rolePermissions?.rules.permissions ?? null),
    [user, rolePermissions],
  )
  const primaryAppRole = useMemo(
    () => getPrimaryAppRoleFromProfile(user),
    [user],
  )
  const visibleNavItems = useMemo(() => {
    return APP_SCREENS.filter((item) => {
      if (isCatalogLoading) {
        return item.id === 'data'
      }

      return isAppScreenVisibleOnSidebar(
        item,
        permissions,
        catalog ?? [],
        primaryAppRole,
      )
    })
  }, [permissions, catalog, isCatalogLoading, primaryAppRole])

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
            collapsed ? 'justify-center px-2' : 'gap-2 px-4',
          )}
        >
          {!collapsed && (
            <Button type="button" size="sm" className="flex-1 gap-1.5">
              <Plus className="size-4" />
              {t('actions.addNew')}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={t('actions.toggleSidebar')}
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
          {visibleNavItems.map((item) =>
            item.children?.length ? (
              <AppNavGroup
                key={item.id}
                item={item}
                label={t(item.labelKey)}
                collapsed={collapsed}
                permissions={permissions}
                catalog={catalog ?? []}
              />
            ) : (
              <AppNavLink
                key={item.id}
                to={item.to!}
                label={t(item.labelKey)}
                icon={item.icon}
                collapsed={collapsed}
              />
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function AppNavGroup({
  item,
  label,
  collapsed,
  permissions,
  catalog,
}: {
  item: AppScreen
  label: string
  collapsed?: boolean
  permissions: Array<string>
  catalog: Array<PermissionCatalogItemT>
}) {
  const { t } = useTranslation('common')
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const visibleChildren = useMemo(
    () =>
      (item.children ?? []).filter((child) =>
        isAppScreenChildVisibleOnSidebar(child, permissions, catalog),
      ),
    [item.children, permissions, catalog],
  )
  const childRoutes = visibleChildren.map((child) => child.to)
  const isChildActive = childRoutes.some((route) => pathname.startsWith(route))
  const [isOpen, setIsOpen] = useState(isChildActive)
  const Icon = item.icon

  useEffect(() => {
    if (isChildActive) {
      setIsOpen(true)
    }
  }, [isChildActive])

  if (visibleChildren.length === 0) {
    return null
  }

  if (collapsed) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-transparent px-2 py-2 text-muted-foreground"
        title={label}
      >
        <Icon className="size-4 shrink-0" />
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
          isChildActive
            ? 'bg-accent/50 text-foreground'
            : 'text-muted-foreground hover:bg-muted/80',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 overflow-hidden text-left whitespace-nowrap">
          {label}
        </span>
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
      </button>
      {isOpen ? (
        <div className="space-y-0.5 pl-3">
          {visibleChildren.map((child) => (
            <AppNavChildLink
              key={child.id}
              child={child}
              label={t(child.labelKey)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AppNavChildLink({
  child,
  label,
}: {
  child: AppScreenChild
  label: string
}) {
  return (
    <Link
      to={child.to as AppScreenTo}
      className="block"
      activeProps={{
        className:
          '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
      }}
      inactiveProps={{
        className: '[&>div]:hover:bg-muted/80',
      }}
    >
      {({ isActive }) => (
        <div
          className={cn(
            'rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
            isActive ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="block overflow-hidden whitespace-nowrap">
            {label}
          </span>
        </div>
      )}
    </Link>
  )
}

function AppNavLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: AppScreenTo
  label: string
  icon: AppScreen['icon']
  collapsed?: boolean
}) {
  return (
    <Link
      to={to}
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
