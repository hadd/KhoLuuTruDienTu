import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS = [
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.warehouse.read',
  },
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.warehouse.search',
  },
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.warehouse.edit',
  },
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.warehouse.delete',
  },
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.warehouse.reupload',
  },
  {
    module: 'archive.warehouse',
    permissionKey: 'archive.warehouse.manage',
  },
] as const satisfies Array<ScreenPermissionRequirement>
