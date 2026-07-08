import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

import {
  RETENTION_PERIOD_CREATE_PERMISSION,
  RETENTION_PERIOD_DELETE_PERMISSION,
  RETENTION_PERIOD_UPDATE_PERMISSION,
  RETENTION_PERIOD_VIEW_PERMISSION,
} from './retentionPeriodManagementPermissions'

const RETENTION_PERIODS_MODULE = 'retention-periods'

export function canViewRetentionPeriods(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    RETENTION_PERIOD_VIEW_PERMISSION,
    RETENTION_PERIODS_MODULE,
  )
}

export function canCreateRetentionPeriods(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    RETENTION_PERIOD_CREATE_PERMISSION,
    RETENTION_PERIODS_MODULE,
  )
}

export function canUpdateRetentionPeriods(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    RETENTION_PERIOD_UPDATE_PERMISSION,
    RETENTION_PERIODS_MODULE,
  )
}

export function canDeleteRetentionPeriods(permissions: Array<string>): boolean {
  return isPermissionGranted(
    permissions,
    RETENTION_PERIOD_DELETE_PERMISSION,
    RETENTION_PERIODS_MODULE,
  )
}
