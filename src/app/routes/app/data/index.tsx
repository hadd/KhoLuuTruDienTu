import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { requirePermission } from '@/features/auth/routeGuards'
import { getUserRoles } from '@/features/auth/store'
import { DataManagementPage } from '@/features/data-management/components/DataManagementPage'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import { dataManagementTreeQueryOptions } from '@/features/data-management/queries'
import { dataManagementSearchSchema } from '@/features/data-management/schemas'
import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/data/')({
  beforeLoad: async ({ context }) => {
    await requirePermission(
      context,
      APP_SCREEN_ACCESS.data.modules.map((module) => ({ module })),
    )
  },
  validateSearch: (raw) => dataManagementSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.main', { ns: 'data-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context }) => {
    const role = getDataRoleForUser()
    try {
      await context.queryClient.ensureQueryData(
        dataManagementTreeQueryOptions(role),
      )
    } catch (error) {
      if (!isNoAssignedDossierError(error)) {
        throw error
      }
    }
    return { role }
  },
  component: AppDataRoute,
  errorComponent: AppDataErrorComponent,
})

function getDataRoleForUser(): DataManagementRole {
  return getPrimaryAppRole(getUserRoles()) ?? 'editor'
}

function AppDataErrorComponent({
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

function AppDataRoute() {
  const { role } = Route.useLoaderData()
  return <DataManagementPage role={role} />
}
