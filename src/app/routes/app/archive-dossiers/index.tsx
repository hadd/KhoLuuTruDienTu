import { createFileRoute, redirect } from '@tanstack/react-router'

import { requirePermission } from '@/features/auth/routeGuards'
import { ARCHIVE_WAREHOUSE_DOSSIER_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
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
})
