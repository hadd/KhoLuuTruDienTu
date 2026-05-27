import { createFileRoute } from '@tanstack/react-router'

import { requireRole } from '@/features/auth/routeGuards'
import { RoleShellLayout } from '@/features/data-management/components/RoleShellLayout'

export const Route = createFileRoute('/qc')({
  beforeLoad: () => requireRole('qc'),
  component: QcLayoutRoute,
})

function QcLayoutRoute() {
  return <RoleShellLayout role="qc" />
}
