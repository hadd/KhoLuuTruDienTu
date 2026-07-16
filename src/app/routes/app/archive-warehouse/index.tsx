import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ArchiveDataHubPage } from '@/features/archive-warehouse/components/ArchiveDataHubPage'
import { ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import { archiveDataHubSearchSchema } from '@/features/archive-warehouse/schemas'
import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-warehouse/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveWarehouse', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    const canByRole =
      primaryAppRole === 'admin' || primaryAppRole === 'manager'
    const canByPermission = ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS.some((item) =>
      canAccessScreen(permissions, item),
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
  validateSearch: (raw) => archiveDataHubSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('hub.title', { ns: 'archive-warehouse' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveDataHubRoute,
  errorComponent: ArchiveDataHubErrorComponent,
})

function ArchiveDataHubRoute() {
  return <ArchiveDataHubPage />
}

function ArchiveDataHubErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-warehouse')
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
