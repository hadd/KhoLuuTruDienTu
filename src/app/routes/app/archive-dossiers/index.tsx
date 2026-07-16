import { createFileRoute, redirect } from '@tanstack/react-router'

import { requirePermission } from '@/features/auth/routeGuards'
import { ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { archiveWarehouseIndexSearchSchema } from '@/features/archive-warehouse/schemas'
import i18n from '@/lib/i18n/config'

/** Legacy URL — redirect into Kho dữ liệu dossiers tab. */
export const Route = createFileRoute('/app/archive-dossiers/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveDossierManagement', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [
      ...ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS,
    ])
    throw redirect({
      to: '/app/archive-warehouse',
      search: { tab: 'dossiers' },
    })
  },
  validateSearch: (raw) => archiveWarehouseIndexSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('page.title', { ns: 'archive-warehouse' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveWarehouseFondsRoute,
  errorComponent: ArchiveWarehouseFondsErrorComponent,
})
