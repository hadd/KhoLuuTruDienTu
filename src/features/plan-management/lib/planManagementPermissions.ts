import { getModuleWildcard } from '@/features/permissions/lib/permissionRules'

export const PROJECT_PLAN_VIEW_PERMISSION = 'project-plans.read'
export const PROJECT_PLAN_CREATE_PERMISSION = 'project-plans.create'
export const PROJECT_PLAN_UPDATE_PERMISSION = 'project-plans.update'
export const PROJECT_PLAN_DELETE_PERMISSION = 'project-plans.delete'

export const PROJECT_PLAN_MANAGE_PERMISSION = getModuleWildcard('project-plans')
