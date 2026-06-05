export type DataManagementRole = 'admin' | 'editor' | 'qc'

export interface RolePermissions {
  canUpload: boolean
  canAssign: boolean
  canAssignEditor: boolean
  canAssignGroup: boolean
  canDelete: boolean
  canRename: boolean
  canAddDocument: boolean
  canContextMenu: boolean
  canEditRecordMetadataFields: boolean
  canEditFileMetadataFields: boolean
}

export const roleConfig: Record<DataManagementRole, RolePermissions> = {
  admin: {
    canUpload: true,
    canAssign: true,
    canAssignEditor: true,
    canAssignGroup: true,
    canDelete: true,
    canRename: true,
    canAddDocument: true,
    canContextMenu: true,
    canEditRecordMetadataFields: true,
    canEditFileMetadataFields: true,
  },
  editor: {
    canUpload: false,
    canAssign: false,
    canAssignEditor: false,
    canAssignGroup: false,
    canDelete: false,
    canRename: true,
    canAddDocument: true,
    canContextMenu: false,
    canEditRecordMetadataFields: false,
    canEditFileMetadataFields: true,
  },
  qc: {
    canUpload: false,
    canAssign: false,
    canAssignEditor: true,
    canAssignGroup: false,
    canDelete: false,
    canRename: true,
    canAddDocument: false,
    canContextMenu: true,
    canEditRecordMetadataFields: true,
    canEditFileMetadataFields: true,
  },
}

export function getPermissionsByRole(role: DataManagementRole): RolePermissions {
  return roleConfig[role]
}
