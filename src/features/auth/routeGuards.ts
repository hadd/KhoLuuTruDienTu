import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'

import {
  canAccessScreen,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import type { ScreenPermissionRequirement } from '@/features/permissions/config/screenPermissionMap'

import { getAccessToken } from './store'

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

  const { permissions } = await loadPermissionContext(context.queryClient)
  const requirements = Array.isArray(requirement) ? requirement : [requirement]

  if (requirements.some((item) => canAccessScreen(permissions, item))) {
    return
  }

  throw redirect({
    to: resolvePermissionFallbackPath(permissions),
  })
}
