import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app/data-config/')({
  beforeLoad: () => {
    throw redirect({ to: '/app/data-config/document-types' })
  },
})
