import { redirect } from '@tanstack/react-router'

import { getAccessToken } from './store'

// Local-only auth guard used by protected routes.
// It only inspects client auth state and never calls the server,
// so it cannot introduce 5xx-style failures by itself.
export function requireAuth() {
  if (!getAccessToken()) {
    throw redirect({ to: '/login' })
  }
}
