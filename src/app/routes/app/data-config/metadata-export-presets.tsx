import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requirePermission } from '@/features/auth/routeGuards'
import { MetadataExportPresetsPage } from '@/features/data-config/components/MetadataExportPresetsPage'
import {
  metadataExportPresetsQueryOptions,
  metadataTemplatesQueryOptions,
} from '@/features/data-config/queries'
import { metadataExportPresetSearchSchema } from '@/features/data-config/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/data-config/metadata-export-presets')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.dataConfig.metadataExportPresets.module,
      permissionKey: APP_SCREEN_ACCESS.dataConfig.metadataExportPresets.permissionKey,
    })
  },
  validateSearch: (raw) => metadataExportPresetSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(metadataExportPresetsQueryOptions()),
      context.queryClient.ensureQueryData(metadataTemplatesQueryOptions()),
    ])
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.metadataExportPresets', { ns: 'data-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: MetadataExportPresetsRoute,
  errorComponent: MetadataExportPresetsErrorComponent,
})

function MetadataExportPresetsRoute() {
  return <MetadataExportPresetsPage />
}

function MetadataExportPresetsErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation('data-config')

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
