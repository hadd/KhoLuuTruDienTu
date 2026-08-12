import { GENERAL_CATALOG_RELATED_PATHS } from '@/features/general-catalog/lib/generalCatalogAccess'
import { DATA_CONFIG_NAV_ITEM_DEFS } from '@/features/navigation/config/dataConfigNavItems'

export const SYSTEM_ADMIN_HUB_PATH = '/app/system-admin' as const

export const SYSTEM_ADMIN_HUB_RELATED_PATHS = [
  SYSTEM_ADMIN_HUB_PATH,
  ...GENERAL_CATALOG_RELATED_PATHS,
  '/app/users',
  '/app/user-management',
  '/app/permissions',
  '/app/audit-logs',
  '/app/data-config',
  ...DATA_CONFIG_NAV_ITEM_DEFS.map((item) => item.to),
] as const
