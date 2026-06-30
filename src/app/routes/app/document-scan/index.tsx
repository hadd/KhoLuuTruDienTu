import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requireAppRole } from '@/features/auth/routeGuards'
import { DocumentScanPage } from '@/features/document-scan/components/DocumentScanPage'
import { scanWorkspaceQueryOptions } from '@/features/document-scan/queries'
import { scanSearchSchema } from '@/features/document-scan/schemas'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/document-scan/')({
  beforeLoad: async ({ context }) => {
    await requireAppRole(context, 'admin')
  },
  validateSearch: (raw) => scanSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(scanWorkspaceQueryOptions())
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('title', { ns: 'document-scan' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: DocumentScanRoute,
  errorComponent: DocumentScanErrorComponent,
})

function DocumentScanRoute() {
  return <DocumentScanPage />
}

function DocumentScanErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('document-scan')
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
