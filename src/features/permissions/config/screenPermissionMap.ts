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
    requirements: [
      ...DATA_ENTRY_SCREEN_REQUIREMENTS,
      { module: 'dossiers', permissionKey: 'dossiers.read' },
      { module: 'dossiers', permissionKey: 'dossiers.write' },
    ],
  },
  dossiers: {
    to: '/app/dossiers',
    module: 'data-entry',
  },
  ocrControl: {
    to: '/app/ocr-control',
    module: 'dossiers',
    permissionKey: 'dossiers.write',
  },
  scanIntake: {
    to: '/app/scan-intake',
    module: 'scan-intake',
    permissionKey: 'scan-intake.use',
  },
  digitization: {
    to: '/app/digitization',
    requirements: [
      { module: 'scan-intake', permissionKey: 'scan-intake.use' },
      { module: 'data-entry', permissionKey: 'data-entry.maker' },
      { module: 'data-entry', permissionKey: 'data-entry.checker' },
      { module: 'dossiers', permissionKey: 'dossiers.read' },
      { module: 'dossiers', permissionKey: 'dossiers.write' },
    ],
  },
  review: {
    to: '/app/review',
    module: 'data-entry',
  },
  auditLogs: {
    to: '/app/audit-logs',
    module: 'audit_logs',
    permissionKey: 'audit_logs.read',
  },
  auditLogConfig: {
    to: '/app/data-config/audit-log-config',
    module: 'audit_logs',
    permissionKey: 'audit_logs.config',
  },
  kpi: {
    to: '/app/audit-logs',
    module: 'audit_logs',
    permissionKey: 'audit_logs.read',
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
  projectManagement: {
    to: '/app/project-management',
    requirements: [
      { module: 'projects', permissionKey: 'projects.read' },
      { module: 'project-plans', permissionKey: 'project-plans.read' },
      { module: 'groups' },
    ],
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
    documentNaming: {
      to: '/app/data-config/document-naming',
      module: 'metadata',
      permissionKey: 'metadata.naming.manage',
    },
    metadataExtractSettings: {
      to: '/app/data-config/metadata-extract-settings',
      module: 'metadata',
      permissionKey: 'metadata.extract.settings.read',
    },
    auditLogConfig: {
      to: '/app/data-config/audit-log-config',
      module: 'audit_logs',
      permissionKey: 'audit_logs.config',
    },
    borrowApprovalClearance: {
      to: '/app/data-config/borrow-approval-clearance',
      module: 'library',
      permissionKey: 'library.borrow.approval-config.manage',
    },
  },
  securityLevel: {
    to: '/app/security-levels',
    module: 'security-levels',
    permissionKey: 'security-levels.read',
  },
} as const

export const APP_SCREEN_PERMISSIONS = {
  users: APP_SCREEN_ACCESS.users.module,
  groups: APP_SCREEN_ACCESS.groups.module,
  data: 'data-entry',
  dossiers: APP_SCREEN_ACCESS.dossiers.module,
  review: APP_SCREEN_ACCESS.review.module,
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
} as const

/** @deprecated use APP_SCREEN_ACCESS */
export const QC_SCREEN_ACCESS = {
  data: { to: APP_SCREEN_ACCESS.data.to, module: 'dossiers' },
} as const
