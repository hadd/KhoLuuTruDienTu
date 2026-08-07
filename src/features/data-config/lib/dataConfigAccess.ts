import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

/** OR any of these opens the Cấu hình dữ liệu hub. */
export const DATA_CONFIG_HUB_SCREEN_REQUIREMENTS = [
  {
    module: 'metadata',
    permissionKey: 'metadata.templates.manage',
  },
  {
    module: 'metadata',
    permissionKey: 'metadata.permissions.manage',
  },
  {
    module: 'metadata',
    permissionKey: 'metadata.export_presets.manage',
  },
  {
    module: 'roles',
    permissionKey: 'roles.manage',
  },
  {
    module: 'watermark',
    permissionKey: 'watermark.config.read',
  },
  {
    module: 'metadata',
    permissionKey: 'metadata.naming.manage',
  },
  {
    module: 'metadata',
    permissionKey: 'metadata.extract.settings.read',
  },
  {
    module: 'audit_logs',
    permissionKey: 'audit_logs.config',
  },
  {
    module: 'library',
    permissionKey: 'library.borrow.approval-config.manage',
  },
] as const satisfies Array<ScreenPermissionRequirement>

export const DATA_CONFIG_RELATED_PATHS = [
  '/app/data-config',
  '/app/data-config/document-types',
  '/app/data-config/document-assignment',
  '/app/data-config/metadata-export-presets',
  '/app/data-config/notification-configs',
  '/app/data-config/watermark-configs',
  '/app/data-config/document-naming',
  '/app/data-config/metadata-extract-settings',
  '/app/data-config/audit-log-config',
  '/app/data-config/borrow-approval-clearance',
] as const
