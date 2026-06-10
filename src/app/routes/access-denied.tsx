import { createFileRoute } from '@tanstack/react-router'

import { AccessDenied } from '@/features/auth/components/AccessDenied'
import { requireAuth } from '@/features/auth/routeGuards'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/access-denied')({
  beforeLoad: () => requireAuth(),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('accessDenied.title', { ns: 'common' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  staticData: {
    crumb: 'Access Denied',
  },
  component: AccessDeniedRoute,
})

function AccessDeniedRoute() {
  return <AccessDenied />
}
