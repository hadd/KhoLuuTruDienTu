import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ScanIntakePage } from '@/features/scan-intake/components/ScanIntakePage'
import { scanAgentHealthQueryOptions } from '@/features/scan-intake/queries'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/scan-intake/')({
  staticData: {
    crumb: () => i18n.t('admin.scanIntake', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, { module: 'dossiers' })
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('page.title', { ns: 'scan-intake' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(scanAgentHealthQueryOptions())
    return {}
  },
  component: ScanIntakeRoute,
  errorComponent: ScanIntakeErrorComponent,
})

function ScanIntakeRoute() {
  return <ScanIntakePage />
}

function ScanIntakeErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('scan-intake')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {tCommon('errors.defaultTitle')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
