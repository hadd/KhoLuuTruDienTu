import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { ArchiveSubmissionPage } from '@/features/archive-submission/components/ArchiveSubmissionPage'
import { archiveDossiersQueryOptions } from '@/features/archive-submission/queries'
import { archiveSubmissionSearchSchema } from '@/features/archive-submission/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import { DEFAULT_LIST_PAGE_LIMIT } from '@/lib/schemas/list-page-search'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/archive-submission/')({
  staticData: {
    crumb: () => i18n.t('admin.archiveSubmission', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, APP_SCREEN_ACCESS.archiveSubmission)
  },
  validateSearch: (raw) => archiveSubmissionSearchSchema.parse(raw),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      archiveDossiersQueryOptions({ page: 1, limit: DEFAULT_LIST_PAGE_LIMIT }),
    )
    return {}
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('page.title', { ns: 'archive-submission' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveSubmissionRoute,
  errorComponent: ArchiveSubmissionErrorComponent,
})

function ArchiveSubmissionRoute() {
  return <ArchiveSubmissionPage />
}

function ArchiveSubmissionErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-submission')
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
