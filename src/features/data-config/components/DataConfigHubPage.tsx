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
import { IconHubBackLink } from '@/features/navigation/components/SectionBackNav'
import { cn } from '@/lib/utils/cn'
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

const DATA_CONFIG_TILE_LABEL_KEYS: Record<
  DataConfigNavItemId,
  | 'tiles.documentTypes'
  | 'tiles.documentAssignment'
  | 'tiles.metadataExportPresets'
  | 'tiles.documentNaming'
  | 'tiles.metadataExtractSettings'
  | 'tiles.notificationConfigs'
  | 'tiles.watermarkConfigs'
  | 'tiles.auditLogConfig'
  | 'tiles.borrowApprovalClearance'
> = {
  'document-types': 'tiles.documentTypes',
  'document-assignment': 'tiles.documentAssignment',
  'metadata-export-presets': 'tiles.metadataExportPresets',
  'document-naming': 'tiles.documentNaming',
  'metadata-extract-settings': 'tiles.metadataExtractSettings',
  'notification-configs': 'tiles.notificationConfigs',
  'watermark-configs': 'tiles.watermarkConfigs',
  'audit-log-config': 'tiles.auditLogConfig',
  'borrow-approval-clearance': 'tiles.borrowApprovalClearance',
}

export function DataConfigHubPage() {
  const { t } = useTranslation('data-config')
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
        label: t(DATA_CONFIG_TILE_LABEL_KEYS[item.id]),
        icon: DATA_CONFIG_TILE_ICONS[item.id],
      }),
    )
  }, [permissions, catalog, t])

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('hub.noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-14">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 sm:gap-12">
        <div className="w-full self-start">
          <IconHubBackLink
            to="/app/system-admin"
            parentLabel={tCommon('admin.groups.systemAdmin')}
            backAriaLabel={tCommon('hubBack.aria', {
              target: tCommon('admin.groups.systemAdmin'),
            })}
          />
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
          {tCommon('admin.dataConfig.title')}
        </h1>

        <div
          className={cn(
            'grid w-full gap-8 sm:gap-10',
            tiles.length <= 2
              ? 'max-w-xl grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
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
                <span className="text-center text-base font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-lg">
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
