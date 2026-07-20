import type { QueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  getPrimaryAppRoleFromProfile,
  loadPermissionContext,
  resolvePermissionFallbackPath,
} from '@/features/auth/lib/permission-access'
import { requireAuth } from '@/features/auth/routeGuards'
import { DataManagementPage } from '@/features/data-management/components/DataManagementPage'
import { EditorNoAssignmentState } from '@/features/data-management/components/EditorNoAssignmentState'
import {
  isProjectScopedDataRole,
  type DataManagementRole,
} from '@/features/data-management/config/roleConfig'
import { isNoAssignedDossierError } from '@/features/data-management/lib/loadErrors'
import {
  canAccessDataManagementScreen,
  resolveDataManagementRole,
} from '@/features/data-management/lib/resolveDataManagementRole'
import {
  dataManagementProjectsQueryOptions,
  dataManagementTreeQueryOptions,
  syncEditorIssueReportFromTree,
} from '@/features/data-management/queries'
import { dataManagementSearchSchema } from '@/features/data-management/schemas'
import { adminProjectStore } from '@/features/data-management/store'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const Route = createFileRoute('/app/data/')({
  staticData: {
    crumb: () => i18n.t('admin.digitization', { ns: 'common' }),
  },
  beforeLoad: async ({ location, context }) => {
    requireAuth()

    const { user, permissions } = await loadPermissionContext(
      context.queryClient,
    )
    const primaryAppRole = getPrimaryAppRoleFromProfile(user)

    if (!canAccessDataManagementScreen(permissions, primaryAppRole)) {
      throw redirect({
        to: resolvePermissionFallbackPath(
          permissions,
          undefined,
          primaryAppRole,
        ),
      })
    }

    const search = dataManagementSearchSchema.parse(location.search)
    const role = await getDataRoleForUser(context.queryClient)

    if (isProjectScopedDataRole(role) && search.projectCode?.trim()) {
      adminProjectStore.setProjectCode(search.projectCode)
      return
    }

    if (!isProjectScopedDataRole(role)) {
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
    const role = await getDataRoleForUser(context.queryClient)
    await context.queryClient.ensureQueryData(
      dataManagementProjectsQueryOptions(),
    )

    if (isProjectScopedDataRole(role)) {
      if (search.projectCode?.trim()) {
        await context.queryClient.ensureQueryData(
          dataManagementTreeQueryOptions(role, search.projectCode),
        )
      }
      return { role }
    }

    try {
      // Editor may scope tree by dossierId (draft). QC must not — dossierId is only
      // a deep-link search param and would split the React Query cache.
      const dossierId =
        role === 'editor' ? search.dossierId?.trim() || undefined : undefined
      const tree = await context.queryClient.ensureQueryData(
        dataManagementTreeQueryOptions(role, undefined, dossierId),
      )
      if (role === 'editor') {
        syncEditorIssueReportFromTree(context.queryClient, tree)
      }
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

async function getDataRoleForUser(
  queryClient: QueryClient,
): Promise<DataManagementRole> {
  const { user, permissions } = await loadPermissionContext(queryClient)
  const primaryAppRole = getPrimaryAppRoleFromProfile(user)
  return resolveDataManagementRole(permissions, primaryAppRole)
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
