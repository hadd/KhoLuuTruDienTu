import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const PROJECT_MANAGEMENT_SCREEN_REQUIREMENTS = [
  { module: 'projects', permissionKey: 'projects.read' },
  { module: 'project-plans', permissionKey: 'project-plans.read' },
  { module: 'groups' },
] as const satisfies Array<ScreenPermissionRequirement>

/** Landing hub + các màn con thuộc menu Quản lý dự án. */
export const PROJECT_MANAGEMENT_RELATED_PATHS = [
  '/app/project-management',
  '/app/project-manager',
  '/app/plan-management',
  '/app/groups',
] as const
