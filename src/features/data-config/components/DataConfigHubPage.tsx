import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  BookOpenCheck,
  Droplets,
  FileSpreadsheet,
  FileText,
  FileType,
  ScanSearch,
  ScrollText,
  UserCog,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import {
  getVisibleDataConfigNavItemDefs,
  type DataConfigNavItemId,
} from '@/features/navigation/config/dataConfigNavItems'
import {
  permissionsCatalogQueryOptions,
  rolePermissionsQueryOptions,
} from '@/features/permissions/queries'

const DATA_CONFIG_TILE_ICONS: Record<DataConfigNavItemId, LucideIcon> = {
  'document-types': FileType,
  'document-assignment': UserCog,
  'metadata-export-presets': FileSpreadsheet,
  'document-naming': FileText,
  'metadata-extract-settings': ScanSearch,
  'notification-configs': Bell,
  'watermark-configs': Droplets,
  'audit-log-config': ScrollText,
  'borrow-approval-clearance': BookOpenCheck,
}

export function DataConfigHubPage() {
  const { t } = useTranslation('data-config')
  const { t: tCommon } = useTranslation('common')
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
    return getVisibleDataConfigNavItemDefs(permissions, catalog).map(
      (item) => ({
        id: item.id,
        to: item.to,
        label: tCommon(item.labelKey),
        icon: DATA_CONFIG_TILE_ICONS[item.id],
      }),
    )
  }, [permissions, catalog, tCommon])

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('hub.noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-14">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 sm:gap-10">
        <h1 className="text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
          {t('title')}
        </h1>

        <div className="grid w-full grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4 lg:grid-cols-5">
          {tiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.id}
                to={tile.to}
                className="group flex flex-col items-center gap-3 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-[4.5rem] items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-20">
                  <Icon
                    className="size-9 sm:size-10"
                    strokeWidth={1.6}
                    aria-hidden
                  />
                </span>
                <span className="text-center text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-[0.95rem]">
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
