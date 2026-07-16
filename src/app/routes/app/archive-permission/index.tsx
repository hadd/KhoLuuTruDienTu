import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'

/** Legacy URL — redirect into Kho dữ liệu permission tab. */
export const Route = createFileRoute('/app/archive-permission/')({
  staticData: {
    crumb: () =>
      i18n.t('admin.archiveWarehousePermission', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    const canByRole =
      primaryAppRole === 'admin' || primaryAppRole === 'manager'
    const canByPermission = canAccessScreen(
      permissions,
      APP_SCREEN_ACCESS.archivePermission,
    )
    if (!canByRole && !canByPermission) {
      throw redirect({
        to: resolvePermissionFallbackPath(
          permissions,
          undefined,
          primaryAppRole,
        ),
      })
    }
    throw redirect({
      to: '/app/archive-warehouse',
      search: { tab: 'permission' },
    })
  },
})
