import { ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { DATA_ENTRY_SCREEN_REQUIREMENTS } from '@/features/data-management/lib/resolveDataManagementRole'
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
    permissionKey: 'users.read',
  },
  groups: {
    to: '/app/groups',
    module: 'groups',
  },
  data: {
    to: '/app/data',
    requirements: DATA_ENTRY_SCREEN_REQUIREMENTS,
  },
  dossiers: {
    to: '/app/dossiers',
    module: 'data-entry',
  },
  scanIntake: {
    to: '/app/scan-intake',
    module: 'scan-intake',
    permissionKey: 'scan-intake.use',
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
    permissionKey: 'roles.manage',
  },
  projectManager: {
    to: '/app/project-manager',
    module: 'projects',
    permissionKey: 'projects.read',
  },
  planManagement: {
    to: '/app/plan-management',
    module: 'project-plans',
    permissionKey: 'project-plans.read',
  },
  archiveFond: {
    to: '/app/archive-fonds',
    module: 'fonds',
    permissionKey: 'fonds.read',
  },
  retentionPeriod: {
    to: '/app/retention-periods',
    module: 'retention-periods',
    permissionKey: 'retention-periods.read',
  },
  inventory: {
    to: '/app/inventories',
    module: 'inventories',
    permissionKey: 'inventories.read',
  },
  dossierType: {
    to: '/app/dossier-types',
    module: 'dossier-types',
    permissionKey: 'dossier-types.read',
  },
  documentType: {
    to: '/app/document-types',
    module: 'document-types',
    permissionKey: 'document-types.read',
  },
  archiveWarehouse: {
    to: '/app/archive-warehouse',
    requirements: [
      ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
      {
        module: 'archive',
        permissionKey: 'archive.config.manage',
      },
      {
        module: 'archive',
        permissionKey: 'archive.submit',
      },
      {
        module: 'archive',
        permissionKey: 'archive.review',
      },
      {
        module: 'archive.warehouse',
        permissionKey: 'archive.permissions.manage',
      },
    ],
  },
  warehouseManagement: {
    to: '/app/warehouse-management',
    requirements: [
      ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
      {
        module: 'archive',
        permissionKey: 'archive.config.manage',
      },
      {
        module: 'archive',
        permissionKey: 'archive.submit',
      },
      {
        module: 'archive',
        permissionKey: 'archive.review',
      },
      {
        module: 'archive.warehouse',
        permissionKey: 'archive.permissions.manage',
      },
      {
        module: 'physical-warehouse',
        permissionKey: 'physical-warehouse.item.read',
      },
    ],
  },
  archiveConfig: {
    to: '/app/archive-config',
    module: 'archive',
    permissionKey: 'archive.config.manage',
  },
  archivePermission: {
    to: '/app/archive-permission',
    module: 'archive.warehouse',
    permissionKey: 'archive.permissions.manage',
  },
  archiveDossiers: {
    to: '/app/archive-dossiers',
    requirements: ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
  },
  archiveSubmission: {
    to: '/app/archive-submission',
    module: 'archive',
    permissionKey: 'archive.submit',
  },
  archiveReview: {
    to: '/app/archive-review',
    module: 'archive',
    permissionKey: 'archive.review',
  },
  physicalWarehouse: {
    to: '/app/physical-warehouse',
    module: 'physical-warehouse',
    permissionKey: 'physical-warehouse.item.read',
  },
  physicalWarehouseConfig: {
    to: '/app/physical-warehouse/config',
    module: 'physical-warehouse',
    permissionKey: 'physical-warehouse.config.manage',
  },
  dataConfig: {
    documentTypes: {
      to: '/app/data-config/document-types',
      module: 'metadata',
      permissionKey: 'metadata.templates.manage',
    },
    documentAssignment: {
      to: '/app/data-config/document-assignment',
      module: 'metadata',
      permissionKey: 'metadata.permissions.manage',
    },
    metadataExportPresets: {
      to: '/app/data-config/metadata-export-presets',
      module: 'metadata',
      permissionKey: 'metadata.export_presets.manage',
    },
    notificationConfigs: {
      to: '/app/data-config/notification-configs',
      module: 'roles',
      permissionKey: 'roles.manage',
    },
    watermarkConfigs: {
      to: '/app/data-config/watermark-configs',
      module: 'watermark',
      permissionKey: 'watermark.config.read',
    },
  },
} as const

export const APP_SCREEN_PERMISSIONS = {
  users: APP_SCREEN_ACCESS.users.module,
  groups: APP_SCREEN_ACCESS.groups.module,
  data: 'data-entry',
  dossiers: APP_SCREEN_ACCESS.dossiers.module,
  review: APP_SCREEN_ACCESS.review.module,
  kpi: APP_SCREEN_ACCESS.kpi.module,
  permissions: APP_SCREEN_ACCESS.permissions.module,
  projectManager: APP_SCREEN_ACCESS.projectManager.module,
  planManagement: APP_SCREEN_ACCESS.planManagement.module,
  archiveFond: APP_SCREEN_ACCESS.archiveFond.module,
  retentionPeriod: APP_SCREEN_ACCESS.retentionPeriod.module,
  inventory: APP_SCREEN_ACCESS.inventory.module,
  dossierType: APP_SCREEN_ACCESS.dossierType.module,
  documentType: APP_SCREEN_ACCESS.documentType.module,
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
