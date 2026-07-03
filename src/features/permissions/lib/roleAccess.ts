import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

export function canManageRoles(permissions: Array<string>): boolean {
  return isPermissionGranted(permissions, 'roles.manage', 'roles')
}
