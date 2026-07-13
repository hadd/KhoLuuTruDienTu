import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchiveWarehouseDossierDetailPage } from '@/features/archive-warehouse/components/ArchiveWarehouseDossierDetailPage'
import { ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { archiveWarehouseDossierDetailSearchSchema } from '@/features/archive-warehouse/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-dossiers/$fondId/$dossierId')({
  staticData: {
    crumb: () => i18n.t('detail.title', { ns: 'archive-warehouse' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [
      ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
    ])
  },
  validateSearch: (raw) => archiveWarehouseDossierDetailSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('detail.title', { ns: 'archive-warehouse' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveWarehouseDossierDetailRoute,
  errorComponent: ArchiveWarehouseDossierDetailErrorComponent,
})

function ArchiveWarehouseDossierDetailRoute() {
  return <ArchiveWarehouseDossierDetailPage />
}

function ArchiveWarehouseDossierDetailErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-warehouse')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.detailFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('errors.detailFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
