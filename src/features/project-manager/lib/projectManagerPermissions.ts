import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

/** Quyền xem dự án */
export const PROJECT_VIEW_PERMISSION = 'projects.read'

/** Full quyền quản lý dự án */
export const PROJECT_MANAGE_PERMISSION = getModuleWildcard('projects')

export const PROJECT_MANAGER_CANDIDATE_PERMISSIONS = [
  PROJECT_VIEW_PERMISSION,
  PROJECT_MANAGE_PERMISSION,
] as const
