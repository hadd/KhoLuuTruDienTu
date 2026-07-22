import { useQuery } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Menu, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/common/AppHeader'
import { Button } from '@/components/ui/button'
import { DIGITIZATION_RELATED_PATHS } from '@/features/digitization/lib/digitizationAccess'
import { PROJECT_MANAGEMENT_RELATED_PATHS } from '@/features/project-management/lib/projectManagementAccess'
import { USER_MANAGEMENT_RELATED_PATHS } from '@/features/user/lib/userManagementAccess'
import { WAREHOUSE_MANAGEMENT_RELATED_PATHS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import type { AppRoleT } from '@/features/auth/constants'
import {
  getPrimaryAppRoleFromProfile,
  isAppScreenChildVisibleOnSidebar,
  isAppScreenVisibleOnSidebar,
} from '@/features/auth/lib/permission-access'
import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import { DATA_CONFIG_RELATED_PATHS } from '@/features/data-config/lib/dataConfigAccess'
import { GENERAL_CATALOG_RELATED_PATHS } from '@/features/general-catalog/lib/generalCatalogAccess'
import type {
  AppScreen,
  AppScreenChild,
  AppScreenTo,
} from '@/features/navigation/config/appNav'
import { APP_SCREENS } from '@/features/navigation/config/appNav'
import {
  permissionsCatalogQueryOptions,
} from '@/features/permissions/queries'
import type { PermissionCatalogItemT } from '@/features/permissions/types'
import { cn } from '@/lib/utils/cn'

export function AppShell() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search })
  const lockContentScroll = useMemo(() => {
    const isDigitizationSubPage = DIGITIZATION_RELATED_PATHS.some(
      (route) =>
        route !== '/app/digitization' &&
        (pathname === route || pathname.startsWith(`${route}/`)),
    )
    if (isDigitizationSubPage) return true

    if (!pathname.includes('/watermark-configs')) return false
    const placementId =
      search &&
      typeof search === 'object' &&
      'placementId' in search &&
      typeof (search as { placementId?: unknown }).placementId === 'string'
        ? (search as { placementId: string }).placementId
        : undefined
    return Boolean(placementId)
  }, [pathname, search])
  const useWarehouseCompactPadding = useMemo(
    () =>
      WAREHOUSE_MANAGEMENT_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
    [pathname],
  )
  const { data: user } = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(getAccessToken()),
  })
  const { data: catalog } = useQuery(permissionsCatalogQueryOptions())
  const permissions = useEffectivePermissions()
  const primaryAppRole = useMemo(
    () => getPrimaryAppRoleFromProfile(user),
    [user],
  )
  const visibleNavItems = useMemo(() => {
    return APP_SCREENS.filter((item) =>
      isAppScreenVisibleOnSidebar(
        item,
        permissions,
        catalog ?? [],
        primaryAppRole,
      ),
    )
  }, [permissions, catalog, primaryAppRole])

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
            'flex h-14 shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center px-2' : 'gap-2 px-4',
          )}
        >
          {!collapsed && primaryAppRole === 'admin' ? (
            <Button
              type="button"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => navigate({ to: '/app/scan-intake' })}
            >
              <Plus className="size-4" />
              {t('actions.addNew')}
            </Button>
          ) : null}
          {!collapsed && primaryAppRole !== 'admin' ? (
            <div className="flex-1" />
          ) : null}
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
                primaryAppRole={primaryAppRole}
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
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-hidden',
              lockContentScroll
                ? 'p-0'
                : useWarehouseCompactPadding
                  ? 'px-6 pb-6 pt-2'
                  : 'p-6',
            )}
          >
            <div
              className={cn(
                'relative flex min-h-0 flex-1 flex-col',
                lockContentScroll ? 'h-0 overflow-hidden' : 'overflow-y-auto',
              )}
            >
              <Outlet />
            </div>
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
  primaryAppRole,
}: {
  item: AppScreen
  label: string
  collapsed?: boolean
  permissions: Array<string>
  catalog: Array<PermissionCatalogItemT>
  primaryAppRole: AppRoleT | null
}) {
  const { t } = useTranslation('common')
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const visibleChildren = useMemo(
    () =>
      (item.children ?? []).filter((child) =>
        isAppScreenChildVisibleOnSidebar(
          child,
          permissions,
          catalog,
          primaryAppRole,
        ),
      ),
    [item.children, permissions, catalog, primaryAppRole],
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
      to={child.to}
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
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const relatedActive =
    (to === '/app/digitization' &&
      DIGITIZATION_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      )) ||
    (to === '/app/project-management' &&
      PROJECT_MANAGEMENT_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      )) ||
    (to === '/app/warehouse-management' &&
      WAREHOUSE_MANAGEMENT_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      )) ||
    (to === '/app/general-catalog' &&
      GENERAL_CATALOG_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      )) ||
    (to === '/app/data-config' &&
      DATA_CONFIG_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      )) ||
    (to === '/app/user-management' &&
      USER_MANAGEMENT_RELATED_PATHS.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ))

  return (
    <Link
      to={to}
      className={cn(
        'block',
        relatedActive &&
          '[&>div]:border-border [&>div]:bg-accent [&>div]:text-accent-foreground',
      )}
      activeProps={{
        className:
          '[&>div]:bg-accent [&>div]:text-accent-foreground [&>div]:border-border',
      }}
      inactiveProps={{
        className: relatedActive ? undefined : '[&>div]:hover:bg-muted/80',
      }}
      title={collapsed ? label : undefined}
    >
      {({ isActive }) => (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-foreground transition-colors',
            !(isActive || relatedActive) && 'text-muted-foreground',
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
