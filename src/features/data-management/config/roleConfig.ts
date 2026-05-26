export type DataManagementRole = 'admin' | 'editor' | 'qc'

export interface RolePermissions {
  canUpload: boolean
  canAssign: boolean
  canAssignEditor: boolean
  canDelete: boolean
  canRename: boolean
  canAddDocument: boolean
  canContextMenu: boolean
}

export const roleConfig: Record<DataManagementRole, RolePermissions> = {
  admin: {
    canUpload: true,
    canAssign: true,
    canAssignEditor: false,
    canDelete: true,
    canRename: true,
    canAddDocument: true,
    canContextMenu: true,
  },
  editor: {
    canUpload: false,
    canAssign: false,
    canAssignEditor: false,
    canDelete: false,
    canRename: true,
    canAddDocument: true,
    canContextMenu: false,
  },
  qc: {
    canUpload: false,
    canAssign: false,
    canAssignEditor: true,
    canDelete: false,
    canRename: true,
    canAddDocument: false,
    canContextMenu: true,
  },
}

export function getPermissionsByRole(role: DataManagementRole): RolePermissions {
  return roleConfig[role]
}
