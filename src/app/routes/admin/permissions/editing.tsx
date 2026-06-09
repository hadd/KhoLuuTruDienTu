import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { EditingPermissionPlaceholder } from '@/features/permissions/components/EditingPermissionPlaceholder'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/admin/permissions/editing')({
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.editing', { ns: 'permissions' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  component: EditingPermissionRoute,
  errorComponent: EditingPermissionErrorComponent,
})

function EditingPermissionRoute() {
  return <EditingPermissionPlaceholder />
}

function EditingPermissionErrorComponent({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { t } = useTranslation('permissions')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <p className="text-sm text-muted-foreground">
        {error.message || t('errors.loadFailed')}
      </p>
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
