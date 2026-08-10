import type { AppScreenPermissionRequirement, AppScreenTo } from '@/features/navigation/config/appNav'
import { isMetadataSidebarChildGranted } from '@/features/navigation/config/sidebarMetadataPermissions'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import type { PermissionCatalogItemT } from '@/features/permissions/types'

export type DataConfigNavItemId =
  | 'document-types'
  | 'document-assignment'
  | 'metadata-export-presets'
  | 'document-naming'
  | 'metadata-extract-settings'
  | 'notification-configs'
  | 'watermark-configs'
  | 'audit-log-config'
  | 'borrow-approval-clearance'

export type DataConfigNavItemDef = {
  id: DataConfigNavItemId
  to: AppScreenTo
  labelKey:
    | 'admin.dataConfig.documentTypes'
    | 'admin.dataConfig.documentAssignment'
    | 'admin.dataConfig.metadataExportPresets'
    | 'admin.dataConfig.documentNaming'
    | 'admin.dataConfig.metadataExtractSettings'
    | 'admin.dataConfig.notificationConfigs'
    | 'admin.dataConfig.watermarkConfigs'
    | 'admin.dataConfig.auditLogConfig'
    | 'admin.dataConfig.borrowApprovalClearance'
}

export const DATA_CONFIG_NAV_ITEM_DEFS: Array<DataConfigNavItemDef> = [
  {
    id: 'document-types',
    to: '/app/data-config/document-types',
    labelKey: 'admin.dataConfig.documentTypes',
  },
  {
    id: 'document-assignment',
    to: '/app/data-config/document-assignment',
    labelKey: 'admin.dataConfig.documentAssignment',
  },
  {
    id: 'metadata-export-presets',
    to: '/app/data-config/metadata-export-presets',
    labelKey: 'admin.dataConfig.metadataExportPresets',
  },
  {
    id: 'document-naming',
    to: '/app/data-config/document-naming',
    labelKey: 'admin.dataConfig.documentNaming',
  },
  {
    id: 'metadata-extract-settings',
    to: '/app/data-config/metadata-extract-settings',
    labelKey: 'admin.dataConfig.metadataExtractSettings',
  },
  {
    id: 'notification-configs',
    to: '/app/data-config/notification-configs',
    labelKey: 'admin.dataConfig.notificationConfigs',
  },
  {
    id: 'watermark-configs',
    to: '/app/data-config/watermark-configs',
    labelKey: 'admin.dataConfig.watermarkConfigs',
  },
  {
    id: 'audit-log-config',
    to: '/app/data-config/audit-log-config',
    labelKey: 'admin.dataConfig.auditLogConfig',
  },
  {
    id: 'borrow-approval-clearance',
    to: '/app/data-config/borrow-approval-clearance',
    labelKey: 'admin.dataConfig.borrowApprovalClearance',
  },
]

export function isDataConfigNavItemVisible(
  id: DataConfigNavItemId,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (
    id === 'document-types' ||
    id === 'document-assignment' ||
    id === 'metadata-export-presets' ||
    id === 'document-naming' ||
    id === 'metadata-extract-settings'
  ) {
    return isMetadataSidebarChildGranted(id, permissions, catalog)
  }
  if (id === 'notification-configs') {
    return isPermissionGranted(permissions, 'roles.manage', 'roles')
  }
  if (id === 'watermark-configs') {
    return isPermissionGranted(permissions, 'watermark.config.read', 'watermark')
  }
  if (id === 'audit-log-config') {
    return isPermissionGranted(permissions, 'audit_logs.config', 'audit_logs')
  }
  if (id === 'borrow-approval-clearance') {
    return isPermissionGranted(
      permissions,
      'library.borrow.approval-config.manage',
      'library',
    )
  }
  return false
}

export function getVisibleDataConfigNavItemDefs(
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
): Array<DataConfigNavItemDef> {
  return DATA_CONFIG_NAV_ITEM_DEFS.filter((item) =>
    isDataConfigNavItemVisible(item.id, permissions, catalog),
  )
}

/** @deprecated use item defs — kept for typed nav link requirements */
export type DataConfigNavPermission = AppScreenPermissionRequirement
