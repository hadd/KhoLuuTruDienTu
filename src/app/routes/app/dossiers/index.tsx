import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { requirePermission } from '@/features/auth/routeGuards'
import { EditorDossierManagementPage } from '@/features/editor-dossiers/components/EditorDossierManagementPage'
import {
  DATA_ENTRY_MAKER_PERMISSION,
  DATA_ENTRY_MODULE,
} from '@/features/data-management/lib/resolveDataManagementRole'
import { editorDraftDossiersQueryOptions } from '@/features/editor-dossiers/queries'
import { editorDossiersSearchSchema } from '@/features/editor-dossiers/schemas'
import i18n from '@/lib/i18n/config'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/dossiers/')({
  staticData: {
    crumb: () => i18n.t('admin.dossierManagement', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, {
      module: DATA_ENTRY_MODULE,
      permissionKey: DATA_ENTRY_MAKER_PERMISSION,
    })
  },
  validateSearch: (raw) => editorDossiersSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.main', { ns: 'editor-dossiers' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      editorDraftDossiersQueryOptions(),
    )
    return {}
  },
  component: EditorDossiersRoute,
  errorComponent: EditorDossiersErrorComponent,
})

function EditorDossiersErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t } = useTranslation('editor-dossiers')
  const { t: tCommon } = useTranslation('common')

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

function EditorDossiersRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const q = search.q ?? ''
  const [inputValue, setInputValue] = useState(q)

  useEffect(() => {
    setInputValue(q)
  }, [q])

  const debouncedNavigate = useDebouncedCallback((next: string) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        q: next.trim() ? next.trim() : undefined,
        page: 1,
      }),
      replace: true,
    })
  }, 300)

  function handleSearchChange(value: string) {
    setInputValue(value)
    debouncedNavigate(value)
  }

  return (
    <EditorDossierManagementPage
      searchQuery={inputValue}
      onSearchQueryChange={handleSearchChange}
    />
  )
}
