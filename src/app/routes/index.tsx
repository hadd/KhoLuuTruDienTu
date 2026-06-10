import { createFileRoute, redirect } from '@tanstack/react-router'

import { APP_HOME_PATH } from '@/features/auth/constants'
import { requireAuth } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    requireAuth()
    throw redirect({ to: APP_HOME_PATH })
  },
})
