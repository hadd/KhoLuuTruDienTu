import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { InventoryManagementPage } from '@/features/inventory/components/InventoryManagementPage'
import { inventoriesQueryOptions } from '@/features/inventory/queries'
import { inventorySearchSchema } from '@/features/inventory/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { DEFAULT_LIST_PAGE_LIMIT } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/inventories/')({
  staticData: {
    crumb: () => i18n.t('admin.inventory', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.inventory)
  },
  validateSearch: (raw) => inventorySearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      inventoriesQueryOptions({ page: 1, limit: DEFAULT_LIST_PAGE_LIMIT }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'inventory' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: InventoryRoute,
  errorComponent: InventoryErrorComponent,
})

function InventoryRoute() {
  return <InventoryManagementPage />
}

function InventoryErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('inventory')
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
