import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { DossierTypeManagementPage } from '@/features/dossier-type/components/DossierTypeManagementPage'
import { dossierTypesQueryOptions } from '@/features/dossier-type/queries'
import { dossierTypeSearchSchema } from '@/features/dossier-type/schemas'
import { generalCatalogChildCrumb } from '@/features/general-catalog/lib/generalCatalogBreadcrumb'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { DEFAULT_LIST_PAGE_LIMIT } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/dossier-types/')({
  staticData: {
    crumb: generalCatalogChildCrumb('tiles.dossierType'),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.dossierType)
  },
  validateSearch: (raw) => dossierTypeSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      dossierTypesQueryOptions({ page: 1, limit: DEFAULT_LIST_PAGE_LIMIT }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'dossier-type' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: DossierTypeRoute,
  errorComponent: DossierTypeErrorComponent,
})

function DossierTypeRoute() {
  return <DossierTypeManagementPage />
}

function DossierTypeErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('dossier-type')
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
