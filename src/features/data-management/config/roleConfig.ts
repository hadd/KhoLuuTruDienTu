import { t } from "i18next"

export type DataManagementRole = 'admin' | 'editor' | 'qc'

export interface RolePermissions {
  canUpload: boolean
  canAssign: boolean
  canDelete: boolean
  canRename: boolean
  canAddDocument: boolean
  canContextMenu: boolean
}

export const roleConfig: Record<DataManagementRole, RolePermissions> = {
  admin: {
    canUpload: true,
    canAssign: true,
    canDelete: true,
    canRename: true,
    canAddDocument: true,
    canContextMenu: true,
  },
  editor: {
    canUpload: false,
    canAssign: false,
    canDelete: false,
    canRename: true,
    canAddDocument: true,
    canContextMenu: false,
  },
  qc: {
    canUpload: true,
    canAssign:  true,
    canDelete: true,
    canRename: true,
    canAddDocument: false,
    canContextMenu: true,
  },
}

export function getPermissionsByRole(role: DataManagementRole): RolePermissions {
  return roleConfig[role]
}
