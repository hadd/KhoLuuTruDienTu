import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { LibraryPage } from '@/features/library/components/LibraryPage'
import { Button } from '@/components/ui/button'
import { translateError } from '@/lib/utils/translate-error'
const librarySearchSchema = z.object({
  tab: z.enum(['borrow', 'reading', 'borrowReview']).optional(),
})

export const Route = createFileRoute('/app/library/')({
  validateSearch: librarySearchSchema,
  component: LibraryRoute,
  errorComponent: LibraryErrorComponent,
})

function LibraryRoute() {
  const { t } = useTranslation('common')
  return <LibraryPage />
}

function LibraryErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {tCommon('errors.loadFailed')}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : tCommon('errors.loadFailed')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}
