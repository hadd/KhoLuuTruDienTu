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
    module: 'audit_logs',
    permissionKey: 'audit_logs.config',
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
  '/app/data-config/audit-log-config',
] as const
