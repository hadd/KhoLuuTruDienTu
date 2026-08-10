import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

export const USER_MANAGEMENT_SCREEN_REQUIREMENTS = [
  { module: 'users', permissionKey: 'users.read' },
  { module: 'roles' },
] as const satisfies Array<ScreenPermissionRequirement>

/** Các màn thuộc khu vực quản lý người dùng (highlight sidebar). */
export const USER_MANAGEMENT_RELATED_PATHS = [
  '/app/user-management',
  '/app/users',
] as const
