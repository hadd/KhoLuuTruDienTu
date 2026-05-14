import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { Button } from '@/components/ui/button'
import { requireAuth } from '@/features/auth/routeGuards'
import { HomeRouter } from '@/features/home/components/HomeRouter'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/')({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [{ title: `Home - Sohoa` }],
  }),
  loader: async ({ context }) => {
    return {}
  },
  staticData: {
    crumb: 'Home',
  },
  component: HomeRoute,
  errorComponent: HomeErrorComponent,
})

function HomeErrorComponent({
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

function HomeRoute() {
  return <HomeRouter />
}
