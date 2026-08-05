import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { ArchiveBorrowViewerPage } from '@/features/archive-borrow/components/ArchiveBorrowViewerPage'
import { ARCHIVE_BORROW_REQUEST_SCREEN_REQUIREMENTS } from '@/features/archive-borrow/lib/archiveBorrowAccess'
import { requirePermission } from '@/features/auth/routeGuards'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

const archiveBorrowViewerSearchSchema = z.object({
  from: z.enum(['library', 'warehouse']).optional(),
  fileId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
})

export const Route = createFileRoute('/app/archive-borrow/$borrowId/view')({
  validateSearch: (raw) => archiveBorrowViewerSearchSchema.parse(raw),
  staticData: {
    crumb: () => i18n.t('page.viewerTitle', { ns: 'archive-borrow' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [
      ...ARCHIVE_BORROW_REQUEST_SCREEN_REQUIREMENTS,
    ])
  },
  head: () => ({
    meta: [
      {
        title: `${i18n.t('page.viewerTitle', { ns: 'archive-borrow' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: ArchiveBorrowViewRoute,
  errorComponent: ArchiveBorrowViewErrorComponent,
})

function ArchiveBorrowViewRoute() {
  const { borrowId } = Route.useParams()
  return <ArchiveBorrowViewerPage borrowId={borrowId} />
}

function ArchiveBorrowViewErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('archive-borrow')
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
