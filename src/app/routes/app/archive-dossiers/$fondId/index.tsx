import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchiveWarehouseDossiersPage } from '@/features/archive-warehouse/components/ArchiveWarehouseDossiersPage'
import { ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { archiveWarehouseFondDossiersSearchSchema } from '@/features/archive-warehouse/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-dossiers/$fondId/')({
  staticData: {
    crumb: () => i18n.t('page.fondDossiersTitle', { ns: 'archive-warehouse' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [
      ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
    ])
  },
  validateSearch: (raw) => archiveWarehouseFondDossiersSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('page.fondDossiersTitle', { ns: 'archive-warehouse' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveWarehouseFondDossiersRoute,
  errorComponent: ArchiveWarehouseFondDossiersErrorComponent,
})

function ArchiveWarehouseFondDossiersRoute() {
  return <ArchiveWarehouseDossiersPage />
}

function ArchiveWarehouseFondDossiersErrorComponent({
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
        {t('errors.loadFailed')}
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
