import { createFileRoute } from '@tanstack/react-router'

import { requireRole } from '@/features/auth/routeGuards'
import { RoleShellLayout } from '@/features/data-management/components/RoleShellLayout'

export const Route = createFileRoute('/editor')({
  beforeLoad: () => requireRole('editor'),
  component: EditorLayoutRoute,
})

function EditorLayoutRoute() {
  return <RoleShellLayout role="editor" />
}
