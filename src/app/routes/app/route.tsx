import { createFileRoute } from '@tanstack/react-router'
import { redirect } from '@tanstack/react-router'

import {
  canAccessPathBySidebar,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { AppShell } from '@/features/navigation/components/AppShell'
import { permissionsCatalogQueryOptions } from '@/features/permissions/queries'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context, location }) => {
    requireAuth()
    if (location.pathname === '/app' || location.pathname === '/app/') {
      return
    }

    const [permissionContext, catalog] = await Promise.all([
      loadPermissionContext(context.queryClient),
      context.queryClient.ensureQueryData(permissionsCatalogQueryOptions()),
    ])
    const primaryAppRole = getPrimaryAppRoleFromProfile(permissionContext.user)
    const isAllowedBySidebar = canAccessPathBySidebar(
      location.pathname,
      permissionContext.permissions,
      catalog,
      primaryAppRole,
    )

    if (!isAllowedBySidebar) {
      throw redirect({ to: '/access-denied' })
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(permissionsCatalogQueryOptions())
    return {}
  },
  component: AppLayoutRoute,
})

function AppLayoutRoute() {
  return <AppShell />
}
