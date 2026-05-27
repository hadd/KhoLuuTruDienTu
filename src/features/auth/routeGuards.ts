import { redirect } from '@tanstack/react-router'

import {
  getHomePathForRoles,
  hasAppRole,
  type AppRoleT,
} from './constants'
import { getAccessToken, getUserRoles } from './store'

// Local-only auth guard used by protected routes.
// It only inspects client auth state and never calls the server,
// so it cannot introduce 5xx-style failures by itself.
export function requireAuth() {
  if (!getAccessToken()) {
    throw redirect({ to: '/login' })
  }
}

export function requireRole(allowedRoles: AppRoleT | AppRoleT[]) {
  requireAuth()

  const roles = getUserRoles()
  if (hasAppRole(roles, allowedRoles)) {
    return
  }

  const homePath = getHomePathForRoles(roles)
  throw redirect({ to: homePath ?? '/login' })
}
