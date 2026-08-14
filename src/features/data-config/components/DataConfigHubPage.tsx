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
  IconHubPageLayout,
  iconHubNestedTileGridClassName,
  iconHubNestedTileGridGapClassName,
  iconHubNestedTileIconClassName,
  iconHubNestedTileIconWrapClassName,
  iconHubNestedTileLabelClassName,
  iconHubNestedTileLinkClassName,
} from '@/features/navigation/components/IconHubPageLayout'
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
    <IconHubPageLayout
      title={tCommon('admin.dataConfig.title')}
      maxWidth="max-w-6xl"
      back={{
        to: '/app/system-admin',
        parentLabel: tCommon('admin.groups.systemAdmin'),
        backAriaLabel: tCommon('hubBack.aria', {
          target: tCommon('admin.groups.systemAdmin'),
        }),
      }}
    >
      <div
        className={cn(
          iconHubNestedTileGridClassName,
          iconHubNestedTileGridGapClassName,
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              to={tile.to}
              className={iconHubNestedTileLinkClassName}
            >
              <span className={iconHubNestedTileIconWrapClassName}>
                <Icon
                  className={iconHubNestedTileIconClassName}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className={iconHubNestedTileLabelClassName}>
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
