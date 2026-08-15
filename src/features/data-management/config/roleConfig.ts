export type DataManagementRole = 'admin' | 'editor' | 'qc' | 'manager'

/** Roles that browse the project-scoped admin folder tree. */
export function isProjectScopedDataRole(
  role: DataManagementRole,
): role is 'admin' | 'manager' {
  return role === 'admin' || role === 'manager'
}

export interface RolePermissions {
  canUpload: boolean
  canAssign: boolean
  canAssignEditor: boolean
  canAssignGroup: boolean
  canAssignProject: boolean
  canReadProjects: boolean
  canRevokeAssignments: boolean
  canDelete: boolean
  canRename: boolean
  canAddDocument: boolean
  canContextMenu: boolean
  canEditRecordMetadataFields: boolean
  canEditFileMetadataFields: boolean
  canViewMetadataEditHistory: boolean
  canDigitalSign: boolean
}

export const roleConfig: Record<DataManagementRole, RolePermissions> = {
  admin: {
    canUpload: true,
    canAssign: true,
    canAssignEditor: true,
    canAssignGroup: true,
    canAssignProject: true,
    canReadProjects: true,
    canRevokeAssignments: true,
    canDelete: true,
    canRename: true,
    canAddDocument: true,
    canContextMenu: true,
    canEditRecordMetadataFields: true,
    canEditFileMetadataFields: false,
    canViewMetadataEditHistory: true,
    canDigitalSign: true,
  },
  editor: {
    canUpload: false,
    canAssign: false,
    canAssignEditor: false,
    canAssignGroup: false,
    canAssignProject: false,
    canReadProjects: false,
    canRevokeAssignments: false,
    canDelete: false,
    canRename: true,
    canAddDocument: true,
    canContextMenu: false,
    canEditRecordMetadataFields: false,
    canEditFileMetadataFields: true,
    canViewMetadataEditHistory: false,
    canDigitalSign: false,
  },
  qc: {
    canUpload: false,
    canAssign: false,
    canAssignEditor: true,
    canAssignGroup: false,
    canAssignProject: true,
    canReadProjects: true,
    canRevokeAssignments: false,
    canDelete: false,
    canRename: true,
    canAddDocument: false,
    canContextMenu: true,
    canEditRecordMetadataFields: true,
    canEditFileMetadataFields: true,
    canViewMetadataEditHistory: false,
    canDigitalSign: true,
  },
  manager: {
    canUpload: true,
    canAssign: true,
    canAssignEditor: true,
    canAssignGroup: true,
    canAssignProject: true,
    canReadProjects: true,
    canRevokeAssignments: true,
    canDelete: true,
    canRename: true,
    canAddDocument: true,
    canContextMenu: true,
    canEditRecordMetadataFields: true,
    canEditFileMetadataFields: true,
    canViewMetadataEditHistory: true,
    canDigitalSign: true,
  },
}

export function getPermissionsByRole(
  role: DataManagementRole,
): RolePermissions {
  return roleConfig[role]
}
