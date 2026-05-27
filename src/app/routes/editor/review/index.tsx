import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { RolePlaceholderPage } from '@/features/data-management/components/RolePlaceholderPage'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/editor/review/')({
  head: () => ({
    meta: [
      {
        title: `${i18n.t('sidebar.items.review', { ns: 'data-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: EditorReviewRoute,
  errorComponent: EditorReviewErrorComponent,
})

function EditorReviewErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">{tCommon('errors.defaultTitle')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {error instanceof Error ? translateError(error) : tCommon('errors.defaultDescription')}
      </p>
      <Button onClick={reset} variant="outline">
        {tCommon('errors.tryAgain')}
      </Button>
    </div>
  )
}

function EditorReviewRoute() {
  return <RolePlaceholderPage titleKey="sidebar.items.review" />
}
