import { createFileRoute, redirect } from '@tanstack/react-router'

import { requirePermission } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'

/** Legacy URL — redirect into the main page config tab. */
export const Route = createFileRoute('/app/physical-warehouse/config')({
  staticData: {
    crumb: () => i18n.t('admin.physicalWarehouseConfig', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.physicalWarehouseConfig.module,
      permissionKey: APP_SCREEN_ACCESS.physicalWarehouseConfig.permissionKey,
    })
    throw redirect({
      to: '/app/physical-warehouse',
      search: { tab: 'config' },
    })
  },
})
