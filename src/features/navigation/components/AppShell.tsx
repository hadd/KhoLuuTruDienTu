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
import {
  getPrimaryAppRoleFromProfile,
  getVisibleNavTree,
} from '@/features/auth/lib/permission-access'
import { useEffectivePermissions } from '@/features/auth/hooks/useEffectivePermissions'
import { profileQueryOptions } from '@/features/auth/queries'
import { getAccessToken } from '@/features/auth/store'
import type {
  NavLinkNode,
  NavNode,
} from '@/features/navigation/config/appNavTree'
import type { AppScreenTo } from '@/features/navigation/config/appNav'
import { permissionsCatalogQueryOptions } from '@/features/permissions/queries'
import { cn } from '@/lib/utils/cn'

function isArchiveBorrowPath(pathname: string) {
  return (
    pathname === '/app/archive-borrow' ||
    pathname.startsWith('/app/archive-borrow/')
  )
}

function getArchiveBorrowFrom(
  search: unknown,
): 'library' | 'warehouse' | undefined {
  if (!search || typeof search !== 'object' || !('from' in search)) {
    return undefined
  }
  const from = (search as { from?: unknown }).from
  if (from === 'library' || from === 'warehouse') return from
  return undefined
}

function isNavLinkActive(
  link: NavLinkNode,
  pathname: string,
  search: unknown,
): boolean {
  const archiveBorrowFrom = getArchiveBorrowFrom(search)
  const archiveBorrowFromLibrary =
    isArchiveBorrowPath(pathname) && archiveBorrowFrom === 'library'

  const routes = [link.to, ...(link.relatedPaths ?? [])]
  const pathMatch = routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
  if (!pathMatch) return false

  if (
    link.id === 'library' &&
    isArchiveBorrowPath(pathname) &&
    !archiveBorrowFromLibrary
  ) {
    return false
  }

  if (
    link.id === 'warehouse-management' &&
    isArchiveBorrowPath(pathname) &&
    archiveBorrowFromLibrary
  ) {
    return false
  }

  return true
}

export function AppShell() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search })
  const lockContentScroll = useMemo(() => {
    const digitizationPaths = [
      '/app/digitization',
      '/app/scan-intake',
      '/app/data',
      '/app/dossiers',
      '/app/ocr-control',
    ]
    const isDigitizationSubPage = digitizationPaths.some(
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
      [
        '/app/warehouse-management',
        '/app/physical-warehouse',
        '/app/archive-warehouse',
        '/app/archive-dossiers',
        '/app/archive-submission',
        '/app/archive-review',
        '/app/archive-borrow',
        '/app/archive-config',
        '/app/archive-permission',
      ].some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
    [pathname],
  )
  const useDossierDetailFlushBottom = useMemo(
    () =>
      /^\/app\/library\/exploitation\/[^/]+\/[^/]+/.test(pathname) ||
      /^\/app\/archive-dossiers\/[^/]+\/[^/]+/.test(pathname),
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
  const visibleNavTree = useMemo(
    () =>
      getVisibleNavTree(permissions, catalog ?? [], primaryAppRole),
    [permissions, catalog, primaryAppRole],
  )

  return (
    <div className="flex h-screen min-h-0 w-full overflow-hidden bg-background">
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-[4.5rem]' : 'w-64',
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
          {visibleNavTree.map((node) => (
            <AppNavNode
              key={node.type === 'link' ? node.id : node.id}
              node={node}
              collapsed={collapsed}
              depth={0}
              pathname={pathname}
              search={search}
            />
          ))}
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
                : useDossierDetailFlushBottom
                  ? 'px-6 pb-0 pt-2'
                  : useWarehouseCompactPadding
                    ? 'px-6 pb-6 pt-2'
                    : 'p-6',
            )}
          >
            <div
              className={cn(
                'relative flex min-h-0 min-w-0 flex-1 flex-col',
                lockContentScroll
                  ? 'h-0 overflow-hidden'
                  : 'overflow-x-hidden overflow-y-auto',
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

function AppNavNode({
  node,
  collapsed,
  depth,
  pathname,
  search,
}: {
  node: NavNode
  collapsed: boolean
  depth: number
  pathname: string
  search: unknown
}) {
  const { t } = useTranslation('common')

  if (node.type === 'link') {
    return (
      <AppNavLink
        link={node}
        label={t(node.labelKey)}
        collapsed={collapsed}
        depth={depth}
        pathname={pathname}
        search={search}
      />
    )
  }

  return (
    <AppNavGroup
      group={node}
      label={t(node.labelKey)}
      collapsed={collapsed}
      depth={depth}
      pathname={pathname}
      search={search}
    />
  )
}

function AppNavGroup({
  group,
  label,
  collapsed,
  depth,
  pathname,
  search,
}: {
  group: Extract<NavNode, { type: 'group' }>
  label: string
  collapsed: boolean
  depth: number
  pathname: string
  search: unknown
}) {
  const { t } = useTranslation('common')
  const isChildActive = group.children.some((child) =>
    isNavLinkActive(child, pathname, search),
  )
  const [isOpen, setIsOpen] = useState(isChildActive)
  const Icon = group.icon

  useEffect(() => {
    if (isChildActive) {
      setIsOpen(true)
    }
  }, [isChildActive])

  if (group.children.length === 0) {
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
          'flex w-full items-center gap-2 rounded-md border border-transparent py-2 text-sm transition-colors',
          depth === 0 ? 'px-3' : 'px-2',
          isChildActive
            ? 'bg-accent/50 text-foreground'
            : 'text-muted-foreground hover:bg-muted/80',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 text-left leading-snug">{label}</span>
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
      </button>
      {isOpen ? (
        <div className={cn('space-y-0.5', depth === 0 ? 'pl-3' : 'pl-2')}>
          {group.children.map((child) => (
            <AppNavLink
              key={child.id}
              link={child}
              label={t(child.labelKey)}
              collapsed={false}
              depth={depth + 1}
              pathname={pathname}
              search={search}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AppNavLink({
  link,
  label,
  collapsed,
  depth,
  pathname,
  search,
}: {
  link: NavLinkNode
  label: string
  collapsed: boolean
  depth: number
  pathname: string
  search: unknown
}) {
  const Icon = link.icon
  const relatedActive = isNavLinkActive(link, pathname, search)

  return (
    <Link
      to={link.to as AppScreenTo}
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
            'flex items-center gap-2 rounded-md border border-transparent py-2 text-sm transition-colors',
            depth === 0 ? 'px-3' : 'px-3 pl-4',
            !(isActive || relatedActive) && 'text-muted-foreground',
            collapsed && depth === 0 && 'justify-center px-2',
            collapsed && depth > 0 && 'hidden',
          )}
        >
          {Icon && depth === 0 ? (
            <Icon className="size-4 shrink-0" />
          ) : null}
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-snug">{label}</span>
          )}
        </div>
      )}
    </Link>
  )
}
