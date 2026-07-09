import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchiveFieldConfigPage } from '@/features/archive-config'
import { archiveFieldConfigsQueryOptions } from '@/features/archive-config/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-config/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveConfig', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.archiveConfig)
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(archiveFieldConfigsQueryOptions())
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'archive-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveConfigRoute,
  errorComponent: ArchiveConfigErrorComponent,
})

function ArchiveConfigRoute() {
  return <ArchiveFieldConfigPage />
}

function ArchiveConfigErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-config')
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
