/** Temporary mock avatar until API returns user.avatarUrl */
export const MOCK_USER_AVATAR_URL = '/mock-user-avatar.svg'

export const APP_ROLES = ['admin', 'manager', 'qc', 'editor'] as const

export type AppRoleT = (typeof APP_ROLES)[number]

export const APP_HOME_PATH = '/app' as const

const EDITOR_ROLE_ALIASES = ['editor', 'editer'] as const
const PROJECT_MANAGER_ROLE_ALIASES = [
  'project_manager',
  'project-manager',
] as const

export function resolveAvatarUrl(avatarUrl?: string | null): string {
  const trimmed = avatarUrl?.trim()
  return trimmed ? trimmed : MOCK_USER_AVATAR_URL
}

export function normalizeAppRole(role: string): AppRoleT | null {
  if (role === 'admin' || role === 'qc' || role === 'manager') {
    return role
  }

  if (
    PROJECT_MANAGER_ROLE_ALIASES.includes(
      role as (typeof PROJECT_MANAGER_ROLE_ALIASES)[number],
    )
  ) {
    return 'manager'
  }

  if (
    EDITOR_ROLE_ALIASES.includes(role as (typeof EDITOR_ROLE_ALIASES)[number])
  ) {
    return 'editor'
  }

  return null
}

export function getPrimaryAppRole(roles: Array<string>): AppRoleT | null {
  const normalizedRoles = roles
    .map(normalizeAppRole)
    .filter((role): role is AppRoleT => role !== null)

  if (normalizedRoles.includes('admin')) {
    return 'admin'
  }

  if (normalizedRoles.includes('manager')) {
    return 'manager'
  }

  if (normalizedRoles.includes('qc')) {
    return 'qc'
  }

  if (normalizedRoles.includes('editor')) {
    return 'editor'
  }

  return null
}

export function hasAppRole(
  roles: Array<string>,
  allowedRoles: AppRoleT | Array<AppRoleT>,
): boolean {
  const allowedList = Array.isArray(allowedRoles)
    ? allowedRoles
    : [allowedRoles]
  const normalizedRoles = roles
    .map(normalizeAppRole)
    .filter((role): role is AppRoleT => role !== null)

  return allowedList.some((role) => normalizedRoles.includes(role))
}
