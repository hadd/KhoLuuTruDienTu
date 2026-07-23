import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchiveWarehouseDocumentsByTypePage } from '@/features/archive-warehouse/components/ArchiveWarehouseDocumentsByTypePage'
import { ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { archiveWarehouseDocumentsByTypeSearchSchema } from '@/features/archive-warehouse/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-dossiers/by-document-type/$documentTypeId/')({
  staticData: {
    crumb: () =>
      i18n.t('page.browseTabDocumentTypes', { ns: 'archive-warehouse' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [
      ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
    ])
  },
  validateSearch: (raw) => archiveWarehouseDocumentsByTypeSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('page.browseTabDocumentTypes', { ns: 'archive-warehouse' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveWarehouseDocumentsByTypeRoute,
  errorComponent: ArchiveWarehouseDocumentsByTypeErrorComponent,
})

function ArchiveWarehouseDocumentsByTypeRoute() {
  return <ArchiveWarehouseDocumentsByTypePage />
}

function ArchiveWarehouseDocumentsByTypeErrorComponent({
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
        {translateError(error instanceof Error ? error : new Error(String(error)))}
      </p>
      <Button type="button" variant="outline" onClick={reset}>
        {tCommon('actions.retry')}
      </Button>
    </div>
  )
}
