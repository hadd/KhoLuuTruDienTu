import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const GENERAL_CATALOG_SCREEN_REQUIREMENTS = [
  { module: 'fonds', permissionKey: 'fonds.read' },
  { module: 'retention-periods', permissionKey: 'retention-periods.read' },
  { module: 'inventories', permissionKey: 'inventories.read' },
  { module: 'dossier-types', permissionKey: 'dossier-types.read' },
  { module: 'document-types', permissionKey: 'document-types.read' },
  { module: 'security-levels', permissionKey: 'security-levels.read' },
] as const satisfies Array<ScreenPermissionRequirement>

export const GENERAL_CATALOG_RELATED_PATHS = [
  '/app/general-catalog',
  '/app/archive-fonds',
  '/app/retention-periods',
  '/app/inventories',
  '/app/dossier-types',
  '/app/document-types',
  '/app/security-levels',
] as const
