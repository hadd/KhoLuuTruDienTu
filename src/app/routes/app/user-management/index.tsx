import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { UserManagementPage } from '@/features/user/components/UserManagementPage'
import { USER_MANAGEMENT_SCREEN_REQUIREMENTS } from '@/features/user/lib/userManagementAccess'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

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
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'user-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: UserManagementRoute,
  errorComponent: UserManagementErrorComponent,
})

function UserManagementRoute() {
  return <UserManagementPage />
}

function UserManagementErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('user-management')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
