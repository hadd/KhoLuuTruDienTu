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
import { IconHubBackLink } from '@/features/navigation/components/SectionBackNav'
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
    <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-14">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10 sm:gap-12">
        <div className="w-full self-start">
          <IconHubBackLink
            to="/app/dashboard"
            parentLabel={t('navigation.home')}
            backAriaLabel={t('hubBack.aria', { target: t('navigation.home') })}
          />
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
          {t('admin.groups.digitization')}
        </h1>

        <div
          className={cn(
            'grid w-full gap-8 sm:gap-10',
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
      </div>
    </div>
  )
}
