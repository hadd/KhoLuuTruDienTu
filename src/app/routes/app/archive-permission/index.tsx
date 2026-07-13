import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchivePermissionConfigPage } from '@/features/archive-permission'
import {
  archivePermissionConfigsQueryOptions,
  readyArchivePermissionConfigOptionsQueryOptions,
} from '@/features/archive-permission/queries'
import { archivePermissionSearchSchema } from '@/features/archive-permission/schemas'
import { adminGroupsQueryOptions } from '@/features/group/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-permission/')({
  staticData: {
    crumb: () =>
      i18n.t('admin.archiveWarehousePermission', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.archivePermission)
  },
  validateSearch: (raw) => archivePermissionSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        archivePermissionConfigsQueryOptions(),
      ),
      context.queryClient.ensureQueryData(
        readyArchivePermissionConfigOptionsQueryOptions(),
      ),
      context.queryClient.ensureQueryData(
        adminGroupsQueryOptions({ page: 1, limit: 100 }),
      ),
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
