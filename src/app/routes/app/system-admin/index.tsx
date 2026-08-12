import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  getPrimaryAppRoleFromProfile,
  isSystemAdminHubVisible,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { SystemAdminHubPage } from '@/features/navigation/components/SystemAdminHubPage'
import { permissionsCatalogQueryOptions } from '@/features/permissions/queries'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/system-admin/')({
  staticData: {
    crumb: () => i18n.t('admin.groups.systemAdmin', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const [{ user, permissions }, catalog] = await Promise.all([
      loadPermissionContext(context.queryClient),
      context.queryClient.ensureQueryData(permissionsCatalogQueryOptions()),
    ])
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)

    if (!isSystemAdminHubVisible(permissions, catalog)) {
      throw redirect({
        to: resolvePermissionFallbackPath(
          permissions,
          catalog,
          primaryAppRole,
        ),
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('admin.groups.systemAdmin', { ns: 'common' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: SystemAdminHubPage,
})
