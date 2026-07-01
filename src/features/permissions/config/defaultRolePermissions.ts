export const LOCKED_ROLE_IDS = ['editor', 'qc'] as const

export type LockedRoleIdT = (typeof LOCKED_ROLE_IDS)[number]

/** Default permissions for base roles — cannot be revoked on the matrix UI. */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  LockedRoleIdT,
  ReadonlyArray<string>
> = {
  qc: [
    'dossiers.read',
    'dossiers.assign',
    'dossiers.export',
    'dossiers.sign',
    'data-entry.checker',
    'folders.read',
    'roles.read',
    'projects.read',
    'groups.*',
    'users.read',
    'metadata.*',
    'users.reset_password',
    'dashboard.qc',
  ],
  editor: [
    'folders.read',
    'dossiers.read',
    'data-entry.maker',
    'groups.read',
    'roles.read',
    'projects.read',
    'users.reset_password',
    'dashboard.editor',
  ],
}

export function normalizeLockedRoleId(roleId: string): LockedRoleIdT | null {
  const normalized = roleId.toLowerCase()
  return (LOCKED_ROLE_IDS as ReadonlyArray<string>).includes(normalized)
    ? (normalized as LockedRoleIdT)
    : null
}

export function isLockedRole(roleId: string): roleId is LockedRoleIdT {
  return normalizeLockedRoleId(roleId) !== null
}

export function getDefaultPermissionsForRole(
  roleId: string,
): ReadonlyArray<string> {
  const lockedRoleId = normalizeLockedRoleId(roleId)
  if (!lockedRoleId) {
    return []
  }

  return DEFAULT_ROLE_PERMISSIONS[lockedRoleId]
}
