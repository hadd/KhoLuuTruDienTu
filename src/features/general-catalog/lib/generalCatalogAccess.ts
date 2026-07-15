import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const GENERAL_CATALOG_SCREEN_REQUIREMENTS = [
  { module: 'fonds', permissionKey: 'fonds.read' },
  { module: 'retention-periods', permissionKey: 'retention-periods.read' },
  { module: 'inventories', permissionKey: 'inventories.read' },
  { module: 'dossier-types', permissionKey: 'dossier-types.read' },
] as const satisfies Array<ScreenPermissionRequirement>

export const GENERAL_CATALOG_RELATED_PATHS = [
  '/app/general-catalog',
  '/app/archive-fonds',
  '/app/retention-periods',
  '/app/inventories',
  '/app/dossier-types',
] as const
