import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { DataManagementPage } from '@/features/data-management/components/DataManagementPage'
import { dataManagementTreeQueryOptions } from '@/features/data-management/queries'
import { dataManagementSearchSchema } from '@/features/data-management/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/qc/data/')({
  validateSearch: (raw) => dataManagementSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.main', { ns: 'data-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(dataManagementTreeQueryOptions('qc'))
    return {}
  },
  component: QcDataRoute,
  errorComponent: QcDataErrorComponent,
})

function QcDataErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">{tCommon('errors.defaultTitle')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : t('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}

function QcDataRoute() {
  return <DataManagementPage role="qc" />
}