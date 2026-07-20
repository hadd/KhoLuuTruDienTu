import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { FunctionPermissionMatrixPage } from '@/features/permissions/components/FunctionPermissionMatrixPage'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { USER_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/user/lib/userManagementAccess'
import {
  permissionRolesQueryOptions,
  permissionsCatalogQueryOptions,
} from '@/features/permissions/queries'
import { functionPermissionSearchSchema } from '@/features/permissions/schemas'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/permissions/function-matrix')({
  staticData: {
    crumb: () => i18n.t('admin.users', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    const canViewUsers = canAccessScreen(permissions, APP_SCREEN_ACCESS.users)
    const canViewPermissions = canAccessScreen(permissions, { module: 'roles' })

    if (
      !USER_MANAGEMENT_SCREEN_REQUIREMENTS.some((item) =>
        canAccessScreen(permissions, item),
      )
    ) {
      throw redirect({
        to: resolvePermissionFallbackPath(
          permissions,
          undefined,
          primaryAppRole,
        ),
      })
    }

    if (!canViewPermissions && canViewUsers) {
      throw redirect({ to: '/app/users' })
    }
  },
  validateSearch: (raw) => functionPermissionSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.functionMatrix', { ns: 'permissions' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(permissionRolesQueryOptions()),
      context.queryClient.ensureQueryData(permissionsCatalogQueryOptions()),
    ])
    return {}
  },
  component: FunctionMatrixRoute,
  errorComponent: FunctionMatrixErrorComponent,
})

function FunctionMatrixRoute() {
  return <FunctionPermissionMatrixPage />
}

function FunctionMatrixErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation('permissions')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="text-sm text-muted-foreground">
        {error.message || t('errors.loadFailed')}
      </p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        {t('actions.retry')}
      </button>
    </div>
  )
}
