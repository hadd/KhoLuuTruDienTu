import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { WarehouseConfigPage } from '@/features/physical-warehouse/components/WarehouseConfigPage'
import { physicalWarehouseLevelsQueryOptions } from '@/features/physical-warehouse/queries'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/physical-warehouse/config')({
  staticData: {
    crumb: () => i18n.t('admin.physicalWarehouseConfig', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.physicalWarehouseConfig.module,
      permissionKey: APP_SCREEN_ACCESS.physicalWarehouseConfig.permissionKey,
    })
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      physicalWarehouseLevelsQueryOptions(),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('config.title', { ns: 'physical-warehouse' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: WarehouseConfigRoute,
  errorComponent: WarehouseConfigErrorComponent,
})

function WarehouseConfigRoute() {
  return <WarehouseConfigPage />
}

function WarehouseConfigErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('physical-warehouse')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {t('errors.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error
          ? translateError(error)
          : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
