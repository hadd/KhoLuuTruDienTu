import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/permissions/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/permissions/function-matrix' })
  },
})
