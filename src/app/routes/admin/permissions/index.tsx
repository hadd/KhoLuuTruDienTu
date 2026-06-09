import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/permissions/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/permissions/function-matrix' })
  },
})
