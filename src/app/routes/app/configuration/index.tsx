import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/configuration/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/system-admin' })
  },
})
