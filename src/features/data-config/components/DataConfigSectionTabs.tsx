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

import { getPrimaryAppRole } from '@/features/auth/constants'
import {
  getCurrentUserRoleId,
  resolvePermissionsForUser,
} from '@/features/auth/lib/permission-access'
import { profileQueryOptions } from '@/features/auth/queries'
import { getUserRoles } from '@/features/auth/store'
import { isMetadataSidebarChildGranted } from '@/features/navigation/config/sidebarMetadataPermissions'
import {
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import {
  permissionsCatalogQueryOptions,
  rolePermissionsQueryOptions,
} from '@/features/permissions/queries'
import { cn } from '@/lib/utils/cn'

export type DataConfigSectionT =
  | 'document-types'
  | 'document-assignment'
  | 'metadata-export-presets'
  | 'notification-configs'
  | 'watermark-configs'
  | 'document-naming'
  | 'metadata-extract-settings'
  | 'audit-log-config'
  | 'borrow-approval-clearance'

type DataConfigSectionTabItem = {
  id: DataConfigSectionT
  to:
    | '/app/data-config/document-types'
    | '/app/data-config/document-assignment'
    | '/app/data-config/metadata-export-presets'
    | '/app/data-config/notification-configs'
    | '/app/data-config/watermark-configs'
    | '/app/data-config/document-naming'
    | '/app/data-config/metadata-extract-settings'
    | '/app/data-config/audit-log-config'
    | '/app/data-config/borrow-approval-clearance'
  label: string
  icon: LucideIcon
}

export function useDataConfigSectionTabs(): Array<DataConfigSectionTabItem> {
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

  // The notification-configs route is guarded by requireAppRole('admin').
  const isAdmin = getPrimaryAppRole(getUserRoles()) === 'admin'

  return useMemo(() => {
    const items: Array<DataConfigSectionTabItem> = []

    if (isMetadataSidebarChildGranted('document-types', permissions, catalog)) {
      items.push({
        id: 'document-types',
        to: '/app/data-config/document-types',
        label: t('tiles.documentTypes'),
        icon: FileType,
      })
    }
    if (
      isMetadataSidebarChildGranted(
        'document-assignment',
        permissions,
        catalog,
      )
    ) {
      items.push({
        id: 'document-assignment',
        to: '/app/data-config/document-assignment',
        label: t('tiles.documentAssignment'),
        icon: UserCog,
      })
    }
    if (
      isMetadataSidebarChildGranted(
        'metadata-export-presets',
        permissions,
        catalog,
      )
    ) {
      items.push({
        id: 'metadata-export-presets',
        to: '/app/data-config/metadata-export-presets',
        label: t('tiles.metadataExportPresets'),
        icon: FileSpreadsheet,
      })
    }
    if (
      isMetadataSidebarChildGranted('document-naming', permissions, catalog)
    ) {
      items.push({
        id: 'document-naming',
        to: '/app/data-config/document-naming',
        label: t('tiles.documentNaming'),
        icon: FileText,
      })
    }
    if (
      isMetadataSidebarChildGranted(
        'metadata-extract-settings',
        permissions,
        catalog,
      )
    ) {
      items.push({
        id: 'metadata-extract-settings',
        to: '/app/data-config/metadata-extract-settings',
        label: t('tiles.metadataExtractSettings'),
        icon: ScanSearch,
      })
    }
    if (isAdmin) {
      items.push({
        id: 'notification-configs',
        to: '/app/data-config/notification-configs',
        label: t('tiles.notificationConfigs'),
        icon: Bell,
      })
    }
    if (
      isPermissionGranted(permissions, 'watermark.config.read', 'watermark')
    ) {
      items.push({
        id: 'watermark-configs',
        to: '/app/data-config/watermark-configs',
        label: t('tiles.watermarkConfigs'),
        icon: Droplets,
      })
    }
    if (isPermissionGranted(permissions, 'audit_logs.config', 'audit_logs')) {
      items.push({
        id: 'audit-log-config',
        to: '/app/data-config/audit-log-config',
        label: t('tiles.auditLogConfig'),
        icon: ScrollText,
      })
    }
    if (
      isPermissionGranted(
        permissions,
        'library.borrow.approval-config.manage',
        'library',
      )
    ) {
      items.push({
        id: 'borrow-approval-clearance',
        to: '/app/data-config/borrow-approval-clearance',
        label: t('tiles.borrowApprovalClearance'),
        icon: BookOpenCheck,
      })
    }

    return items
  }, [permissions, catalog, isAdmin, t])
}

export function DataConfigSectionTabs({
  active,
}: {
  active: DataConfigSectionT
}) {
  const tabs = useDataConfigSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  return (
    <nav
      className={cn(sectionBoxedTabsListClassName, 'shrink-0')}
      aria-label="Data config sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active

        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(
              sectionBoxedTabsTriggerCompactClassName,
              'inline-flex items-center',
            )}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
