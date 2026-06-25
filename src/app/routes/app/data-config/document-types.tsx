import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requirePermission } from '@/features/auth/routeGuards'
import { DocumentTypeConfigPage } from '@/features/data-config/components/DocumentTypeConfigPage'
import { metadataTemplatesQueryOptions } from '@/features/data-config/queries'
import { documentTypeSearchSchema } from '@/features/data-config/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/data-config/document-types')({
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: APP_SCREEN_ACCESS.dataConfig.documentTypes.module,
      permissionKey: APP_SCREEN_ACCESS.dataConfig.documentTypes.permissionKey,
    })
  },
  validateSearch: (raw) => documentTypeSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(metadataTemplatesQueryOptions())
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.documentTypes', { ns: 'data-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: DocumentTypeConfigRoute,
  errorComponent: DocumentTypeConfigErrorComponent,
})

function DocumentTypeConfigRoute() {
  return <DocumentTypeConfigPage />
}

function DocumentTypeConfigErrorComponent({
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
