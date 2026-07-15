import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requireAuth } from '@/features/auth/routeGuards'
import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { ArchivePermissionConfigPage } from '@/features/archive-permission'
import {
  archiveAclCatalogQueryOptions,
  archiveAclMatrixQueryOptions,
} from '@/features/archive-permission/queries'
import { archivePermissionSearchSchema } from '@/features/archive-permission/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

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
  },
  validateSearch: (raw) => archivePermissionSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(archiveAclMatrixQueryOptions()),
      context.queryClient.ensureQueryData(archiveAclCatalogQueryOptions()),
    ])
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'archive-permission' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchivePermissionRoute,
  errorComponent: ArchivePermissionErrorComponent,
})

function ArchivePermissionRoute() {
  return <ArchivePermissionConfigPage />
}

function ArchivePermissionErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-permission')
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
