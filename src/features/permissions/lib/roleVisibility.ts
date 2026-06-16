import type { PermissionRoleT } from '@/features/permissions/types'

const HIDDEN_PERMISSION_ROLE_IDS = new Set(['admin'])

export function isPermissionRoleVisible(
  role: Pick<PermissionRoleT, 'id'>,
): boolean {
  return !HIDDEN_PERMISSION_ROLE_IDS.has(role.id.toLowerCase())
}
