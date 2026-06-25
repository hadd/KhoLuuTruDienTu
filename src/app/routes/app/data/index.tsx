import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { requireAuth } from '@/features/auth/routeGuards'
import { getUserRoles } from '@/features/auth/store'
import { DataManagementPage } from '@/features/data-management/components/DataManagementPage'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import { dataManagementTreeQueryOptions, dataManagementProjectsQueryOptions } from '@/features/data-management/queries'
import { dataManagementSearchSchema } from '@/features/data-management/schemas'
import { adminProjectStore } from '@/features/data-management/store'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/data/')({
  beforeLoad: async ({ location }) => {
    requireAuth()

    const search = dataManagementSearchSchema.parse(location.search)
    const role = getDataRoleForUser()

    if (role === 'admin' && search.projectCode?.trim()) {
      adminProjectStore.setProjectCode(search.projectCode)
      return
    }

    if (role !== 'admin') {
      return
    }

    const storedProjectCode = adminProjectStore.getState().projectCode
    if (storedProjectCode?.trim()) {
      throw redirect({
        to: '/app/data',
        search: {
          ...search,
          projectCode: storedProjectCode,
        },
      })
    }

    const projects = await context.queryClient.ensureQueryData(
      dataManagementProjectsQueryOptions(),
    )
    const firstProject = projects.items[0]
    if (!firstProject?.projectCode?.trim()) return

    adminProjectStore.setProjectCode(firstProject.projectCode)

    throw redirect({
      to: '/app/data',
      search: {
        ...search,
        projectCode: firstProject.projectCode,
      },
    })
  },
  validateSearch: (raw) => dataManagementSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('pageTitles.main', { ns: 'data-management' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context, location }) => {
    const search = dataManagementSearchSchema.parse(location.search)
    const role = getDataRoleForUser()
    await context.queryClient.ensureQueryData(
      dataManagementProjectsQueryOptions(),
    )

    if (role === 'admin') {
      if (search.projectCode?.trim()) {
        await context.queryClient.ensureQueryData(
          dataManagementTreeQueryOptions(role, search.projectCode),
        )
      }
      return { role }
    }

    try {
      const dossierId = search.dossierId?.trim()
      await context.queryClient.ensureQueryData(
        dataManagementTreeQueryOptions(
          role,
          undefined,
          dossierId || undefined,
        ),
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
