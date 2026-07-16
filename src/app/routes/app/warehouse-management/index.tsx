import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS } from '@/features/archive-warehouse/lib/archiveWarehouseAccess'
import {
  canAccessScreen,
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { WarehouseManagementPage } from '@/features/warehouse-management/components/WarehouseManagementPage'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

const PHYSICAL_REQUIREMENT = {
  module: APP_SCREEN_ACCESS.physicalWarehouse.module,
  permissionKey: APP_SCREEN_ACCESS.physicalWarehouse.permissionKey,
}

export const Route = createFileRoute('/app/warehouse-management/')({
  staticData: {
    crumb: () => i18n.t('admin.warehouseManagement', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    requireAuth()
    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)
    const canByRole =
      primaryAppRole === 'admin' || primaryAppRole === 'manager'
    const canPhysical = canAccessScreen(permissions, PHYSICAL_REQUIREMENT)
    const canData = ARCHIVE_DATA_HUB_SCREEN_REQUIREMENTS.some((item) =>
      canAccessScreen(permissions, item),
    )
    if (!canByRole && !canPhysical && !canData) {
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
        title: `${i18n.t('title', { ns: 'warehouse-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: WarehouseManagementRoute,
  errorComponent: WarehouseManagementErrorComponent,
})

function WarehouseManagementRoute() {
  return <WarehouseManagementPage />
}

function WarehouseManagementErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('warehouse-management')
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
