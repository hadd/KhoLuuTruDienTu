import type { UserRoleT } from '@/features/auth/types'

// Role name constants
export const ROLE_TEACHER = 'teacher'
export const ROLE_ADMIN = 'admin'
export const ROLE_SCHOOL_ADMIN = 'school_admin'

// Menu group IDs
export const MENU_GROUP_TEACHING = 'teaching'
export const MENU_GROUP_QUESTION_BANK = 'questionBank'
export const MENU_GROUP_SCHOOL_MANAGEMENT = 'schoolManagement'
export const MENU_GROUP_TOOLS = 'tools'

// Role to menu group mapping
// Note: Role names are normalized to lowercase for case-insensitive matching
const ROLE_MENU_MAPPING: Record<string, Array<string>> = {
  [ROLE_TEACHER]: [
    MENU_GROUP_TEACHING,
    MENU_GROUP_QUESTION_BANK,
    MENU_GROUP_TOOLS,
  ],
  [ROLE_ADMIN]: [MENU_GROUP_SCHOOL_MANAGEMENT, MENU_GROUP_TOOLS],
  [ROLE_SCHOOL_ADMIN]: [
    MENU_GROUP_SCHOOL_MANAGEMENT,
    MENU_GROUP_QUESTION_BANK,
    MENU_GROUP_TOOLS,
  ],
  // Also support "school admin" (with space) variation
  'school admin': [
    MENU_GROUP_SCHOOL_MANAGEMENT,
    MENU_GROUP_QUESTION_BANK,
    MENU_GROUP_TOOLS,
  ],
}

/**
 * Extract role name from UserRoleT safely
 */
export function getRoleName(role: UserRoleT | null | any): string | null {
  if (!role) {
    return null
  }
  return role.role.name
}

/**
 * Get allowed menu group IDs for a given role name
 * Returns empty array if role is null or unknown
 * Case-insensitive comparison to handle API variations
 */
export function getAllowedMenuGroups(roleName: string | null): Array<string> {
  if (!roleName) {
    return []
  }
  // Normalize to lowercase for case-insensitive comparison
  const normalizedRoleName = roleName.toLowerCase()
  return ROLE_MENU_MAPPING[normalizedRoleName] ?? []
}
