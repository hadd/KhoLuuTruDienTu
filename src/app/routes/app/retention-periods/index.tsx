import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { RetentionPeriodManagementPage } from '@/features/retention-period/components/RetentionPeriodManagementPage'
import { retentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import { retentionPeriodSearchSchema } from '@/features/retention-period/schemas'
import { generalCatalogChildCrumb } from '@/features/general-catalog/lib/generalCatalogBreadcrumb'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { DEFAULT_LIST_PAGE_LIMIT } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/retention-periods/')({
  staticData: {
    crumb: generalCatalogChildCrumb('tiles.retention'),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.retentionPeriod)
  },
  validateSearch: (raw) => retentionPeriodSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      retentionPeriodsQueryOptions({ page: 1, limit: DEFAULT_LIST_PAGE_LIMIT }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'retention-period' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: RetentionPeriodRoute,
  errorComponent: RetentionPeriodErrorComponent,
})

function RetentionPeriodRoute() {
  return <RetentionPeriodManagementPage />
}

function RetentionPeriodErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('retention-period')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error
          ? translateError(error)
          : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
