import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/routeGuards'
import { AppShell } from '@/features/navigation/components/AppShell'
import { permissionsCatalogQueryOptions } from '@/features/permissions/queries'

export const Route = createFileRoute('/app')({
  beforeLoad: () => requireAuth(),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(permissionsCatalogQueryOptions())
    return {}
  },
  component: AppLayoutRoute,
})

function AppLayoutRoute() {
  return <AppShell />
}
