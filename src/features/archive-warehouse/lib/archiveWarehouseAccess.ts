import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS = [
  {
    module: 'archive-warehouse',
    permissionKey: 'archive.warehouse.read',
  },
  {
    module: 'archive-warehouse',
    permissionKey: 'archive.warehouse.manage',
  },
  {
    module: 'search',
    permissionKey: 'search.global',
  },
] as const satisfies Array<ScreenPermissionRequirement>
