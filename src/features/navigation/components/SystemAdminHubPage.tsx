import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  FolderKanban,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  canAccessAppScreenForSidebar,
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { GENERAL_CATALOG_SCREEN_REQUIREMENTS } from '@/features/general-catalog/lib/generalCatalogAccess'
import type { AppScreenTo } from '@/features/navigation/config/appNav'
import { IconHubPageLayout } from '@/features/navigation/components/IconHubPageLayout'
import { getVisibleDataConfigNavItemDefs } from '@/features/navigation/config/dataConfigNavItems'
import {
  permissionsCatalogQueryOptions,
  rolePermissionsQueryOptions,
} from '@/features/permissions/queries'
import { cn } from '@/lib/utils/cn'

type HubTile = {
  id: string
  to: AppScreenTo
  label: string
  icon: LucideIcon
}

export function SystemAdminHubPage() {
  const { t } = useTranslation('common')
  const { data: user } = useQuery(profileQueryOptions)
  const roleId = getCurrentUserRoleId(user)
  const { data: rolePermissions } = useQuery({
    ...rolePermissionsQueryOptions(roleId ?? ''),
    enabled: Boolean(roleId),
  })
  const { data: catalog = [] } = useQuery(permissionsCatalogQueryOptions())

  const permissions = useMemo(
    () =>
      resolvePermissionsForUser(
        user,
        rolePermissions?.rules.permissions ?? null,
      ),
    [user, rolePermissions],
  )

  const tiles = useMemo(() => {
    const items: Array<HubTile> = []

    if (
      canAccessAppScreenForSidebar(
        permissions,
        [...GENERAL_CATALOG_SCREEN_REQUIREMENTS],
        catalog,
      )
    ) {
      items.push({
        id: 'general-catalog',
        to: '/app/general-catalog',
        label: t('admin.generalCatalog.title'),
        icon: FolderKanban,
      })
    }

    if (
      canAccessAppScreenForSidebar(
        permissions,
        { module: 'users', permissionKey: 'users.read' },
        catalog,
      )
    ) {
      items.push({
        id: 'users',
        to: '/app/users',
        label: t('admin.users'),
        icon: Users,
      })
    }

    if (canAccessAppScreenForSidebar(permissions, { module: 'roles' }, catalog)) {
      items.push({
        id: 'permissions',
        to: '/app/permissions/function-matrix',
        label: t('admin.permissions'),
        icon: ShieldCheck,
      })
    }

    if (
      canAccessAppScreenForSidebar(
        permissions,
        { module: 'audit_logs', permissionKey: 'audit_logs.read' },
        catalog,
      )
    ) {
      items.push({
        id: 'audit-logs',
        to: '/app/audit-logs',
        label: t('admin.auditLogs'),
        icon: ScrollText,
      })
    }

    if (getVisibleDataConfigNavItemDefs(permissions, catalog).length > 0) {
      items.push({
        id: 'data-config',
        to: '/app/data-config',
        label: t('admin.dataConfig.title'),
        icon: Settings2,
      })
    }

    return items
  }, [permissions, catalog, t])

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('accessDenied.description')}
      </div>
    )
  }

  return (
    <IconHubPageLayout title={t('admin.groups.systemAdmin')}>
      <div
        className={cn(
          'grid w-full gap-8 sm:gap-10',
          tiles.length === 1
            ? 'max-w-xs grid-cols-1'
            : tiles.length === 2
              ? 'max-w-xl grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              to={tile.to}
              className="group flex flex-col items-center gap-4 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-36 items-center justify-center rounded-[2rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-44">
                <Icon
                  className="size-16 sm:size-20"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className="text-center text-lg font-medium text-foreground transition-colors group-hover:text-primary sm:text-xl">
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
