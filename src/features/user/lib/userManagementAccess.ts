import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const USER_MANAGEMENT_SCREEN_REQUIREMENTS = [
  { module: 'users', permissionKey: 'users.read' },
  { module: 'roles' },
] as const satisfies Array<ScreenPermissionRequirement>

/** Landing + các màn con thuộc menu Quản lý người dùng. */
export const USER_MANAGEMENT_RELATED_PATHS = [
  '/app/user-management',
  '/app/users',
  '/app/permissions/function-matrix',
] as const
