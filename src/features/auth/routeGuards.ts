import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'

import { getPrimaryAppRole, type AppRoleT } from '@/features/auth/constants'
import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

import { getAccessToken, getUserRoles } from './store'

type RouteGuardContext = {
  queryClient: QueryClient
}

// Local-only auth guard used by protected routes.
// It only inspects client auth state and never calls the server,
// so it cannot introduce 5xx-style failures by itself.
export function requireAuth() {
  if (!getAccessToken()) {
    throw redirect({ to: '/login' })
  }
}

export async function requirePermission(
  context: RouteGuardContext,
  requirement: ScreenPermissionRequirement | ScreenPermissionRequirement[],
) {
  requireAuth()

  const { user, permissions } = await loadPermissionContext(context.queryClient)
  const primaryAppRole = getPrimaryAppRoleFromProfile(user)
  const requirements = Array.isArray(requirement) ? requirement : [requirement]

  if (requirements.some((item) => canAccessScreen(permissions, item))) {
    return
  }

  throw redirect({
    to: resolvePermissionFallbackPath(permissions, undefined, primaryAppRole),
  })
}

export async function requireAppRole(
  context: RouteGuardContext,
  allowedRole: AppRoleT,
) {
  requireAuth()

  const { user, permissions } = await loadPermissionContext(context.queryClient)
  const primaryAppRole =
    getPrimaryAppRole(getUserRoles()) ?? getPrimaryAppRoleFromProfile(user)

  if (primaryAppRole === allowedRole) {
    return
  }

  throw redirect({
    to: resolvePermissionFallbackPath(permissions, undefined, primaryAppRole),
  })
}
