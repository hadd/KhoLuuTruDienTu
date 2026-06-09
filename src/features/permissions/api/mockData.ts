import type {
  PermissionGrantT,
  PermissionRoleT,
  SystemFunctionT,
} from '@/features/permissions/types'

export const mockPermissionRoles: PermissionRoleT[] = [
  { id: 'role-admin', code: 'admin', name: 'Administrator' },
  { id: 'role-qc', code: 'qc', name: 'Quality Control' },
  { id: 'role-editor', code: 'editor', name: 'Editor' },
]

export const mockSystemFunctions: SystemFunctionT[] = [
  {
    id: 'fn-user-management',
    code: 'user_management',
    name: 'User management',
    description: 'Manage system users and their accounts',
  },
  {
    id: 'fn-group-management',
    code: 'group_management',
    name: 'Group management',
    description: 'Create and manage work groups',
  },
  {
    id: 'fn-data-management',
    code: 'data_management',
    name: 'Data management',
    description: 'Browse and manage document folders and dossiers',
  },
  {
    id: 'fn-editing',
    code: 'editing',
    name: 'Editing',
    description: 'Edit document metadata and content',
  },
  {
    id: 'fn-approval',
    code: 'approval',
    name: 'Approval',
    description: 'Review and approve submitted documents',
  },
  {
    id: 'fn-kpi-report',
    code: 'kpi_report',
    name: 'KPI report',
    description: 'View performance and KPI reports',
  },
  {
    id: 'fn-permission-management',
    code: 'permission_management',
    name: 'Permission management',
    description: 'Configure role-based access to system functions',
  },
  {
    id: 'fn-import-data',
    code: 'import_data',
    name: 'Import data',
    description: 'Import data from external sources',
  },
  {
    id: 'fn-export-data',
    code: 'export_data',
    name: 'Export data',
    description: 'Export data to external formats',
  },
]

const FN = Object.fromEntries(mockSystemFunctions.map((fn) => [fn.code, fn.id]))
const ROLE = Object.fromEntries(mockPermissionRoles.map((role) => [role.code, role.id]))

function buildInitialGrants(): PermissionGrantT[] {
  const grants: PermissionGrantT[] = []

  const addGrants = (roleCode: keyof typeof ROLE, functionCodes: Array<keyof typeof FN>) => {
    for (const fnCode of functionCodes) {
      grants.push({ roleId: ROLE[roleCode], functionId: FN[fnCode] })
    }
  }

  addGrants('admin', [
    'user_management',
    'group_management',
    'data_management',
    'editing',
    'approval',
    'kpi_report',
    'permission_management',
    'import_data',
    'export_data',
  ])

  addGrants('qc', [
    'group_management',
    'data_management',
    'approval',
    'kpi_report',
    'export_data',
  ])

  addGrants('editor', ['data_management', 'editing', 'export_data'])

  return grants
}

export const initialMockGrants = buildInitialGrants()
