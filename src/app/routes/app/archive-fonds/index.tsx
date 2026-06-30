import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchiveFondManagementPage } from '@/features/archive-fond/components/ArchiveFondManagementPage'
import { archiveFondsQueryOptions } from '@/features/archive-fond/queries'
import { archiveFondSearchSchema } from '@/features/archive-fond/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-fonds/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveFond', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.archiveFond.module,
    })
  },
  validateSearch: (raw) => archiveFondSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(archiveFondsQueryOptions())
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'archive-fond' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveFondRoute,
  errorComponent: ArchiveFondErrorComponent,
})

function ArchiveFondRoute() {
  return <ArchiveFondManagementPage />
}

function ArchiveFondErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-fond')
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
