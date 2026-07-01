import { DASHBOARD_SCREEN_REQUIREMENTS } from '@/features/permissions/lib/dashboardAccess'

export type ScreenPermissionRequirement = {
  module: string
  permissionKey?: string
}

export const APP_SCREEN_ACCESS = {
  dashboard: {
    to: '/app/dashboard',
    requirements: DASHBOARD_SCREEN_REQUIREMENTS,
  },
  users: {
    to: '/app/users',
    module: 'users',
  },
  groups: {
    to: '/app/groups',
    module: 'groups',
  },
  data: {
    to: '/app/data',
    modules: ['data-entry'] as const,
  },
  dossiers: {
    to: '/app/dossiers',
    module: 'data-entry',
  },
  scanIntake: {
    to: '/app/scan-intake',
    module: 'dossiers',
  },
  review: {
    to: '/app/review',
    module: 'data-entry',
  },
  kpi: {
    to: '/app/kpi',
    module: 'audit_logs',
  },
  permissions: {
    to: '/app/permissions/function-matrix',
    module: 'roles',
  },
  projectManager: {
    to: '/app/project-manager',
    module: 'projects',
  },
  planManagement: {
    to: '/app/plan-management',
    module: 'projects',
  },
  archiveFond: {
    to: '/app/archive-fonds',
    module: 'projects',
  },
  dataConfig: {
    documentTypes: {
      to: '/app/data-config/document-types',
      module: 'metadata',
      permissionKey: 'metadata.templates',
    },
    documentAssignment: {
      to: '/app/data-config/document-assignment',
      module: 'metadata',
      permissionKey: 'metadata.field_permissions',
    },
  },
} as const

export const APP_SCREEN_PERMISSIONS = {
  users: APP_SCREEN_ACCESS.users.module,
  groups: APP_SCREEN_ACCESS.groups.module,
  data: APP_SCREEN_ACCESS.data.modules,
  dossiers: APP_SCREEN_ACCESS.dossiers.module,
  review: APP_SCREEN_ACCESS.review.module,
  kpi: APP_SCREEN_ACCESS.kpi.module,
  permissions: APP_SCREEN_ACCESS.permissions.module,
  projectManager: APP_SCREEN_ACCESS.projectManager.module,
  planManagement: APP_SCREEN_ACCESS.planManagement.module,
  archiveFond: APP_SCREEN_ACCESS.archiveFond.module,
  dataConfigDocumentTypes: APP_SCREEN_ACCESS.dataConfig.documentTypes.module,
  dataConfigDocumentAssignment:
    APP_SCREEN_ACCESS.dataConfig.documentAssignment.module,
} as const

/** @deprecated use APP_SCREEN_ACCESS */
export const ADMIN_SCREEN_ACCESS = {
  users: APP_SCREEN_ACCESS.users,
  groups: APP_SCREEN_ACCESS.groups,
  data: { to: APP_SCREEN_ACCESS.data.to, module: 'dossiers' },
  permissions: APP_SCREEN_ACCESS.permissions,
} as const

/** @deprecated use APP_SCREEN_ACCESS */
export const EDITOR_SCREEN_ACCESS = {
  data: { to: APP_SCREEN_ACCESS.data.to, module: 'data-entry' },
  review: APP_SCREEN_ACCESS.review,
  kpi: APP_SCREEN_ACCESS.kpi,
} as const

/** @deprecated use APP_SCREEN_ACCESS */
export const QC_SCREEN_ACCESS = {
  data: { to: APP_SCREEN_ACCESS.data.to, module: 'dossiers' },
  kpi: APP_SCREEN_ACCESS.kpi,
} as const
