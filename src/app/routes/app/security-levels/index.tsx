import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { generalCatalogChildCrumb } from '@/features/general-catalog/lib/generalCatalogBreadcrumb'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { SecurityLevelManagementPage } from '@/features/security-level/components/SecurityLevelManagementPage'
import { securityLevelsQueryOptions } from '@/features/security-level/queries'
import { securityLevelSearchSchema } from '@/features/security-level/schemas'
import { DEFAULT_LIST_PAGE_LIMIT } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/security-levels/')({
  staticData: {
    crumb: generalCatalogChildCrumb('tiles.securityLevel'),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.securityLevel)
  },
  validateSearch: (raw) => securityLevelSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      securityLevelsQueryOptions({ page: 1, limit: DEFAULT_LIST_PAGE_LIMIT }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'security-level' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: SecurityLevelRoute,
  errorComponent: SecurityLevelErrorComponent,
})

function SecurityLevelRoute() {
  return <SecurityLevelManagementPage />
}

function SecurityLevelErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('security-level')
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
