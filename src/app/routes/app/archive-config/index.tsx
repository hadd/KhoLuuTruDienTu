import { createFileRoute, redirect } from '@tanstack/react-router'

import { requirePermission } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'

/** Legacy URL — redirect into Kho dữ liệu config tab. */
export const Route = createFileRoute('/app/archive-config/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveConfig', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.archiveConfig)
    throw redirect({
      to: '/app/archive-warehouse',
      search: { tab: 'config' },
    })
  },
})
