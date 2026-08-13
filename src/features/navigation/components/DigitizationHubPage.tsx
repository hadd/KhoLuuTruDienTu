import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Briefcase, FileStack } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  canAccessAppScreenForSidebar,
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { DIGITIZATION_SCREEN_REQUIREMENTS } from '@/features/digitization/lib/digitizationAccess'
import type { AppScreenTo } from '@/features/navigation/config/appNav'
import {
  IconHubPageLayout,
  iconHubTileGridGapClassName,
  iconHubTileIconClassName,
  iconHubTileIconWrapClassName,
  iconHubTileLabelClassName,
  iconHubTileLinkClassName,
} from '@/features/navigation/components/IconHubPageLayout'
import { PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/project-management/lib/projectManagementAccess'
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

export function DigitizationHubPage() {
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
        [...PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS],
        catalog,
      )
    ) {
      items.push({
        id: 'project-management',
        to: '/app/project-management',
        label: t('admin.projectManagement'),
        icon: Briefcase,
      })
    }

    if (
      canAccessAppScreenForSidebar(
        permissions,
        [...DIGITIZATION_SCREEN_REQUIREMENTS],
        catalog,
      )
    ) {
      items.push({
        id: 'digitization',
        to: '/app/digitization',
        label: t('admin.digitization'),
        icon: FileStack,
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
    <IconHubPageLayout
      title={t('admin.groups.digitization')}
      maxWidth="max-w-3xl"
    >
      <div
        className={cn(
          'grid w-full',
          iconHubTileGridGapClassName,
          tiles.length === 1
            ? 'max-w-xs grid-cols-1'
            : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              to={tile.to}
              className={iconHubTileLinkClassName}
            >
              <span className={iconHubTileIconWrapClassName}>
                <Icon
                  className={iconHubTileIconClassName}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className={iconHubTileLabelClassName}>{tile.label}</span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
