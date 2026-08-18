export interface PermissionCatalogItemT {
  key: string
  module: string
  label: string
  description: string
}

export interface PermissionRoleT {
  id: string
  name: string
  description?: string | null
  isBaseRole?: boolean
}

export interface RolePermissionRulesT {
  permissions: Array<string>
  restrictions: Array<string>
}

export interface RolePermissionsRecordT {
  roleId: string
  roleName: string
  isBaseRole: boolean
  hiddenModules: Array<string>
  rules: RolePermissionRulesT
  catalog: Array<PermissionCatalogItemT>
}

export interface UpdateRolePermissionsPayloadT {
  roleId: string
  permissions: Array<string>
  restrictions: Array<string>
  hiddenModules?: Array<string>
}

export interface AdminRoleWritePayloadT {
  id: string
  name: string
  description: string
}

/** @deprecated Legacy matrix shape — no longer used by the 3-column editor */
export interface PermissionGrantT {
  roleId: string
  permissionKey: string
}

/** @deprecated */
export type PermissionMatrixT = Array<PermissionGrantT>
