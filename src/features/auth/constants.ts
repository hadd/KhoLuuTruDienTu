/** Temporary mock avatar until API returns user.avatarUrl */
export const MOCK_USER_AVATAR_URL = '/mock-user-avatar.svg'

export const APP_ROLES = ['admin', 'qc', 'editor'] as const

export type AppRoleT = (typeof APP_ROLES)[number]

export const ROLE_HOME_PATHS: Record<AppRoleT, '/admin/users' | '/qc/data' | '/editor/data'> = {
  admin: '/admin/users',
  qc: '/qc/data',
  editor: '/editor/data',
}

const EDITOR_ROLE_ALIASES = ['editor', 'editer'] as const

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim()
  return trimmed ? trimmed : MOCK_USER_AVATAR_URL
}

export function normalizeAppRole(role: string): AppRoleT | null {
  if (role === 'admin' || role === 'qc') {
    return role
  }

  if (EDITOR_ROLE_ALIASES.includes(role as (typeof EDITOR_ROLE_ALIASES)[number])) {
    return 'editor'
  }

  return null
}

export function getPrimaryAppRole(roles: string[]): AppRoleT | null {
  const normalizedRoles = roles
    .map(normalizeAppRole)
    .filter((role): role is AppRoleT => role !== null)

  if (normalizedRoles.includes('admin')) {
    return 'admin'
  }

  if (normalizedRoles.includes('qc')) {
    return 'qc'
  }

  if (normalizedRoles.includes('editor')) {
    return 'editor'
  }

  return null
}

export function getHomePathForRoles(roles: string[]) {
  const primaryRole = getPrimaryAppRole(roles)
  return primaryRole ? ROLE_HOME_PATHS[primaryRole] : null
}

export function hasAppRole(
  roles: string[],
  allowedRoles: AppRoleT | AppRoleT[],
): boolean {
  const allowedList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const normalizedRoles = roles
    .map(normalizeAppRole)
    .filter((role): role is AppRoleT => role !== null)

  return allowedList.some((role) => normalizedRoles.includes(role))
}
