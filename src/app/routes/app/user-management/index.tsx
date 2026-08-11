import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { USER_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/user/lib/userManagementAccess'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/user-management/')({
  staticData: {
    crumb: () => i18n.t('admin.users', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    const canAccess = USER_MANAGEMENT_SCREEN_REQUIREMENTS.some((item) =>
      canAccessScreen(permissions, item),
    )

    if (!canAccess) {
      throw redirect({
        to: resolvePermissionFallbackPath(
          permissions,
          undefined,
          primaryAppRole,
        ),
      })
    }

    if (
      canAccessScreen(permissions, {
        module: 'users',
        permissionKey: 'users.read',
      })
    ) {
      throw redirect({ to: '/app/users' })
    }

    throw redirect({ to: '/app/permissions/function-matrix' })
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'user-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  // Unreachable — beforeLoad always redirects.
  component: () => null,
})
