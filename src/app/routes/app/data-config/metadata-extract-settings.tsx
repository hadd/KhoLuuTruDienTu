import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { MetadataExtractSettingsPage } from '@/features/metadata-extract/components/MetadataExtractSettingsPage'
import { metadataExtractSettingsQueryOptions } from '@/features/metadata-extract/queries'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute(
  '/app/data-config/metadata-extract-settings',
)({
  staticData: {
    crumb: () => i18n.t('tiles.metadataExtractSettings', { ns: 'data-config' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(
      context,
      APP_SCREEN_ACCESS.dataConfig.metadataExtractSettings,
    )
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      metadataExtractSettingsQueryOptions(),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'metadata-extract-settings' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: MetadataExtractSettingsRoute,
  errorComponent: MetadataExtractSettingsErrorComponent,
})

function MetadataExtractSettingsRoute() {
  return <MetadataExtractSettingsPage />
}

function MetadataExtractSettingsErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('metadata-extract-settings')
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
