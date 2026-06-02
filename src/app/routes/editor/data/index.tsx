import { createFileRoute } from '@tanstack/react-router'

import { DataManagementPage } from '@/features/data-management/components/DataManagementPage'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import { dataManagementTreeQueryOptions } from '@/features/data-management/queries'
import { dataManagementSearchSchema } from '@/features/data-management/schemas'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/editor/data/')({
  validateSearch: (raw) => dataManagementSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.main', { ns: 'data-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(
        dataManagementTreeQueryOptions('editor'),
      )
    } catch (error) {
      if (!isNoAssignedDossierError(error)) {
        throw error
      }
    }
    return {}
  },
  component: EditorDataRoute,
  errorComponent: EditorDataErrorComponent,
})

function EditorDataErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('data-management')
  const { t: tCommon } = useTranslation('common')

  if (isNoAssignedDossierError(error)) {
    return <EditorNoAssignmentState />
  }

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
      <h2 className="mb-2 text-xl font-semibold text-destructive">
        {tCommon('errors.defaultTitle')}
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

function EditorDataRoute() {
  return <DataManagementPage role="editor" />
}
