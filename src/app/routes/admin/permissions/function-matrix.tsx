import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { FunctionPermissionMatrixPage } from '@/features/permissions/components/FunctionPermissionMatrixPage'
import {
  permissionRolesQueryOptions,
  permissionsCatalogQueryOptions,
} from '@/features/permissions/queries'
import { functionPermissionSearchSchema } from '@/features/permissions/schemas'
import i18n from '@/lib/i18n/config'

export const Route = createFileRoute('/admin/permissions/function-matrix')({
  validateSearch: (raw) => functionPermissionSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.functionMatrix', { ns: 'permissions' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(permissionRolesQueryOptions()),
      context.queryClient.ensureQueryData(permissionsCatalogQueryOptions()),
    ])
    return {}
  },
  component: FunctionMatrixRoute,
  errorComponent: FunctionMatrixErrorComponent,
})

function FunctionMatrixRoute() {
  return <FunctionPermissionMatrixPage />
}

function FunctionMatrixErrorComponent({
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
