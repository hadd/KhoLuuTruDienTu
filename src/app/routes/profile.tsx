import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { Button } from '@/components/ui/button'
import { profileQueryOptions } from '@/features/auth/queries'
import { requireAuth } from '@/features/auth/routeGuards'
import { Profile } from '@/features/profile/components/Profile'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/profile')({
  beforeLoad: requireAuth,
  head: () => ({
    title: `${i18n.t('pageTitles.profile', { ns: 'profile' })} - ${i18n.t('pageTitles.appName', { ns: 'common' })}`,
  }),
  loader: async ({ context }) => {
    // Prefetch profile data
    await context.queryClient.ensureQueryData(profileQueryOptions)
    return {}
  },
  staticData: {
    crumb: 'Profile',
  },
  component: ProfileRoute,
  errorComponent: ProfileErrorComponent,
})

function ProfileErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('common')

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-lg border border-destructive bg-card p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-destructive">
            {t('errors.defaultTitle')}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {error instanceof Error
              ? translateError(error)
              : t('errors.defaultDescription')}
          </p>
          <Button onClick={reset} variant="outline">
            {t('errors.tryAgain')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}

function ProfileRoute() {
  return (
    <DashboardLayout>
      <Profile />
    </DashboardLayout>
  )
}
