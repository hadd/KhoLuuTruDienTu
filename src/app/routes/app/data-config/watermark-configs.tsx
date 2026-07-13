import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requirePermission } from '@/features/auth/routeGuards'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { WatermarkConfigPage } from '@/features/watermark-config/components/WatermarkConfigPage'
import {
  watermarkImagesQueryOptions,
  watermarkPlacementsQueryOptions,
} from '@/features/watermark-config/queries'
import { watermarkConfigSearchSchema } from '@/features/watermark-config/schemas'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/data-config/watermark-configs')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.dataConfig.watermarkConfigs)
  },
  validateSearch: (raw) => watermarkConfigSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(watermarkPlacementsQueryOptions()),
      context.queryClient.ensureQueryData(watermarkImagesQueryOptions()),
    ])
    return {}
  },
  staticData: {
    crumb: () =>
      i18n.t('pageTitles.watermarkConfigs', {
        ns: 'watermark-config',
      }),
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.watermarkConfigs', { ns: 'watermark-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: WatermarkConfigRoute,
  errorComponent: WatermarkConfigErrorComponent,
})

function WatermarkConfigRoute() {
  return <WatermarkConfigPage />
}

function WatermarkConfigErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation('watermark-config')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8">
      <p className="text-sm text-muted-foreground">{t('errors.loadFailed')}</p>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        {t('actions.retry')}
      </button>
    </div>
  )
}
