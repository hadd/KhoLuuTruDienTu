import { createFileRoute, redirect } from '@tanstack/react-router'

import { requirePermission } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'

/** Legacy URL — redirect into Kho dữ liệu submission tab. */
export const Route = createFileRoute('/app/archive-submission/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveSubmission', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.archiveSubmission)
    throw redirect({
      to: '/app/archive-warehouse',
      search: { tab: 'submission' },
    })
  },
})
