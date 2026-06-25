import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/app/')({
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    throw redirect({
      to: resolvePermissionFallbackPath(permissions, undefined, primaryAppRole),
    })
  },
})
