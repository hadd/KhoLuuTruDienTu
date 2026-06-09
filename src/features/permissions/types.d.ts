export type PermissionRoleCodeT = 'admin' | 'qc' | 'editor'

export type SystemFunctionCodeT =
  | 'user_management'
  | 'group_management'
  | 'data_management'
  | 'editing'
  | 'approval'
  | 'kpi_report'
  | 'permission_management'
  | 'import_data'
  | 'export_data'

export interface PermissionRoleT {
  id: string
  code: PermissionRoleCodeT
  name: string
}

export interface SystemFunctionT {
  id: string
  code: SystemFunctionCodeT
  name: string
  description: string
}

export interface PermissionGrantT {
  roleId: string
  functionId: string
}

export interface UpdatePermissionGrantPayloadT {
  roleId: string
  functionId: string
  granted: boolean
}

export type PermissionMatrixT = PermissionGrantT[]
