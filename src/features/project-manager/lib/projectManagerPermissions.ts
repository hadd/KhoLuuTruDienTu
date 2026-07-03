import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

/** Quyền xem dự án */
export const PROJECT_VIEW_PERMISSION = 'projects.read'

/** Quyền tạo dự án */
export const PROJECT_CREATE_PERMISSION = 'projects.create'

/** Quyền cập nhật dự án */
export const PROJECT_UPDATE_PERMISSION = 'projects.update'

/** Quyền xóa dự án */
export const PROJECT_DELETE_PERMISSION = 'projects.delete'

/** Full quyền quản lý dự án */
export const PROJECT_MANAGE_PERMISSION = getModuleWildcard('projects')

export const PROJECT_MANAGER_CANDIDATE_PERMISSIONS = [
  PROJECT_VIEW_PERMISSION,
] as const
