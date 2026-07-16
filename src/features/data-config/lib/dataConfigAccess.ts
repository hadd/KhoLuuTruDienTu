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
] as const satisfies Array<ScreenPermissionRequirement>

export const DATA_CONFIG_RELATED_PATHS = [
  '/app/data-config',
  '/app/data-config/document-types',
  '/app/data-config/document-assignment',
  '/app/data-config/metadata-export-presets',
  '/app/data-config/notification-configs',
  '/app/data-config/watermark-configs',
] as const
