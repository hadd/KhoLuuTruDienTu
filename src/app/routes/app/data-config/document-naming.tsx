import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { requirePermission } from '@/features/auth/routeGuards'
import { DocumentNamingConfigPage } from '@/features/document-naming-config/components/DocumentNamingConfigPage'
import {
  documentNamingFieldCatalogQueryOptions,
} from '@/features/document-naming-config/queries'
import { documentNamingSearchSchema } from '@/features/document-naming-config/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/app/data-config/document-naming')({
  beforeLoad: async ({ context }) => {
    await requirePermission(
      context,
      APP_SCREEN_ACCESS.dataConfig.documentNaming,
    )
  },
  validateSearch: (raw) => documentNamingSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(activeArchiveFondsQueryOptions()),
      context.queryClient.ensureQueryData(documentNamingFieldCatalogQueryOptions()),
    ])
    return {}
  },
  staticData: {
    crumb: () =>
      i18n.t('pageTitles.documentNaming', {
        ns: 'document-naming-config',
      }),
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.documentNaming', { ns: 'document-naming-config' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: DocumentNamingConfigRoute,
  errorComponent: DocumentNamingErrorComponent,
})

function DocumentNamingConfigRoute() {
  return <DocumentNamingConfigPage />
}

function DocumentNamingErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation('document-naming-config')

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
