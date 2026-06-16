/**
 * Central re-export hub for all feature types.
 * This file makes all feature types discoverable for AI agents and provides
 * a single import point for routes and shared components.
 *
 * Types are organized by feature domain in `features/{domain}/types.d.ts`.
 * This file re-exports them for convenience and discoverability.
 */

// Auth types
export type { UserT } from '@/features/auth/types'

// User types
export type {
  AdminRoleRulesT,
  AdminRoleT,
  AdminRoleUserRoleT,
} from '@/features/user/types'

// Permissions types
export type {
  AdminRoleWritePayloadT,
  PermissionCatalogItemT,
  PermissionGrantT,
  PermissionMatrixT,
  PermissionRoleT,
  RolePermissionRulesT,
  RolePermissionsRecordT,
  UpdateRolePermissionsPayloadT,
} from '@/features/permissions/types'

// Admin dashboard types
export type {
  AdminDashboardActivityT,
  AdminDashboardGroupStatsT,
  AdminDashboardOcrTrendPointT,
  AdminDashboardRoleDistributionT,
  AdminDashboardT,
} from '@/features/admin-dashboard/types'

// Editor dashboard types
export type {
  EditorDashboardAccuracyT,
  EditorDashboardCompletedPointT,
  EditorDashboardPeriodT,
  EditorDashboardT,
} from '@/features/editor-dashboard/types'

// QC dashboard types
export type {
  QcCheckerRoleT,
  QcDashboardEfficiencyT,
  QcDashboardGroupEditorT,
  QcDashboardGroupMemberT,
  QcDashboardGroupT,
  QcDashboardStepStatsT,
  QcDashboardT,
} from '@/features/qc-dashboard/types'
