export type ScreenPermissionRequirement = {
  module: string
  permissionKey?: string
}

export const APP_SCREEN_ACCESS = {
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
    modules: ['dossiers', 'data-entry'] as const,
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
  dataConfig: {
    to: '/app/data-config/document-types',
    module: 'roles',
  },
} as const

export const APP_SCREEN_PERMISSIONS = {
  users: APP_SCREEN_ACCESS.users.module,
  groups: APP_SCREEN_ACCESS.groups.module,
  data: APP_SCREEN_ACCESS.data.modules,
  review: APP_SCREEN_ACCESS.review.module,
  kpi: APP_SCREEN_ACCESS.kpi.module,
  permissions: APP_SCREEN_ACCESS.permissions.module,
  dataConfig: APP_SCREEN_ACCESS.dataConfig.module,
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
