import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const RETENTION_PERIOD_VIEW_PERMISSION = 'retention-periods.read'
export const RETENTION_PERIOD_CREATE_PERMISSION = 'retention-periods.create'
export const RETENTION_PERIOD_UPDATE_PERMISSION = 'retention-periods.update'
export const RETENTION_PERIOD_DELETE_PERMISSION = 'retention-periods.delete'

export const RETENTION_PERIOD_MANAGE_PERMISSION = getModuleWildcard(
  'retention-periods',
)
