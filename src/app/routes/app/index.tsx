import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/app/')({
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { permissions } = await loadPermissionContext(context.queryClient)
    throw redirect({ to: resolvePermissionFallbackPath(permissions) })
  },
})
