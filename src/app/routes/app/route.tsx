import { createFileRoute } from '@tanstack/react-router'

import { requireAuth } from '@/features/auth/routeGuards'
import { AppShell } from '@/features/navigation/components/AppShell'

export const Route = createFileRoute('/app')({
  beforeLoad: () => requireAuth(),
  component: AppLayoutRoute,
})

function AppLayoutRoute() {
  return <AppShell />
}
