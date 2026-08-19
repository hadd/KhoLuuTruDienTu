import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppHeader } from '@/components/common/AppHeader'
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
      '/app/permissions/function-matrix',
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
        '/app/library',
      ].some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
    [pathname],
  )
  const useIconHubPadding = useMemo(() => {
    const normalized =
      pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname
    return (
      [
        '/app/digitization-hub',
        '/app/warehouse-management',
        '/app/system-admin',
        '/app/general-catalog',
        '/app/data-config',
        '/app/project-management',
        '/app/digitization',
        '/app/library',
      ].includes(normalized)
    )
  }, [pathname])
  const useDossierDetailFlushBottom = useMemo(
    () =>
      /^\/app\/library\/exploitation\/[^/]+\/[^/]+/.test(pathname) ||
      /^\/app\/archive-dossiers\/[^/]+\/[^/]+/.test(pathname),
    [pathname],
  )
  const lockLibraryListScroll = useMemo(() => {
    const normalized =
      pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname
    const isIconHubLanding = [
      '/app/digitization-hub',
      '/app/warehouse-management',
      '/app/system-admin',
      '/app/general-catalog',
      '/app/data-config',
      '/app/project-management',
      '/app/digitization',
      '/app/library',
    ].includes(normalized)
    const isLibraryList =
      (pathname === '/app/library' || pathname.startsWith('/app/library/')) &&
      !useDossierDetailFlushBottom
    const isProjectSectionList = [
      '/app/project-manager',
      '/app/plan-management',
      '/app/groups',
      '/app/audit-logs',
    ].some((route) => pathname === route || pathname === `${route}/`)
    return isIconHubLanding || isLibraryList || isProjectSectionList
  }, [pathname, useDossierDetailFlushBottom])
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

  const isDocumentEditorWindow = pathname.includes(
    '/archive-warehouse/document-editor/',
  )

  if (isDocumentEditorWindow) {
    return (
      <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden bg-background">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden bg-background">
      <AppHeader
        collapsed={collapsed}
        onToggleSidebar={() => setCollapsed((prev) => !prev)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-card transition-[width] duration-300 ease-in-out will-change-[width]',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >        <nav className="flex w-full min-w-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-3">
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
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
              lockContentScroll
                ? 'p-0'
                : useDossierDetailFlushBottom
                  ? 'px-6 pb-0 pt-2'
                  : useWarehouseCompactPadding || useIconHubPadding
                    ? 'px-6 pb-6 pt-2'
                    : 'p-6',
            )}
          >
            <div
              className={cn(
                'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden',
                lockContentScroll
                  ? 'h-0 overflow-hidden'
                  : lockLibraryListScroll
                    ? 'overflow-hidden'
                    : 'overflow-y-auto',
              )}
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>
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

  const showChildren = isOpen && !collapsed

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => {
          if (collapsed) return
          setIsOpen((prev) => !prev)
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-transparent py-2 text-sm transition-colors',
          depth === 0 ? 'px-3' : 'px-2',
          isChildActive
            ? 'bg-accent/50 text-foreground'
            : 'text-muted-foreground hover:bg-muted/80',
        )}
        title={collapsed ? label : undefined}
      >
        <Icon className="size-4 shrink-0" />
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap text-left leading-snug transition-[max-width] duration-300 ease-in-out',
            collapsed ? 'max-w-0' : 'max-w-[11rem] flex-1',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'shrink-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out',
            collapsed ? 'max-w-0 opacity-0' : 'max-w-4 opacity-100',
          )}
        >
          {isOpen ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          showChildren ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div
          className={cn(
            'space-y-0.5 overflow-hidden',
            depth === 0 ? 'pl-3' : 'pl-2',
          )}
        >
          {group.children.map((child) => (
            <AppNavLink
              key={child.id}
              link={child}
              label={t(child.labelKey)}
              collapsed={collapsed}
              depth={depth + 1}
              pathname={pathname}
              search={search}
            />
          ))}
        </div>
      </div>
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
          )}
        >
          {Icon && depth === 0 ? (
            <Icon className="size-4 shrink-0" />
          ) : null}
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap leading-snug transition-[max-width] duration-300 ease-in-out',
              collapsed ? 'max-w-0' : 'max-w-[11rem] flex-1',
            )}
          >
            {label}
          </span>
        </div>
      )}
    </Link>
  )
}
