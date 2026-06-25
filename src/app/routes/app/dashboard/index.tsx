import { useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  AdminDashboardPage,
  type AdminRoleChartTypeT,
} from '@/features/admin-dashboard/components/AdminDashboardPage'
import { adminDashboardQueryOptions } from '@/features/admin-dashboard/queries'
import type { AdminDashboardDossierTrendGranularityT } from '@/features/admin-dashboard/types'
import { requirePermission } from '@/features/auth/routeGuards'
import { loadPermissionContext } from '@/features/auth/lib/permission-access'
import { EditorDashboardPage } from '@/features/editor-dashboard/components/EditorDashboardPage'
import { editorDashboardQueryOptions } from '@/features/editor-dashboard/queries'
import type { EditorDashboardPeriodT } from '@/features/editor-dashboard/types'
import { QcDashboardPage } from '@/features/qc-dashboard/components/QcDashboardPage'
import { isQcGroupLeaderOnlyError } from '@/features/qc-dashboard/lib/loadErrors'
import {
  qcDashboardGroupQueryOptions,
  qcDashboardQueryOptions,
} from '@/features/qc-dashboard/queries'
import {
  DASHBOARD_SCREEN_REQUIREMENTS,
  resolveDashboardVariant,
} from '@/features/permissions/lib/dashboardAccess'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

const dashboardSearchSchema = z.object({
  roleChart: z
    .enum(['pie', 'bar', 'line', 'horizontalBar'])
    .optional()
    .catch('pie' satisfies AdminRoleChartTypeT),
  dossierTrendGranularity: z
    .enum(['month', 'quarter'])
    .optional()
    .catch('month' satisfies AdminDashboardDossierTrendGranularityT),
  period: z
    .enum(['7d', '30d', '90d', '12m'])
    .optional()
    .catch('30d' satisfies EditorDashboardPeriodT),
})

export type DashboardSearchT = z.infer<typeof dashboardSearchSchema>

const routeApi = getRouteApi('/app/dashboard/')

export const Route = createFileRoute('/app/dashboard/')({
  staticData: {
    crumb: () => i18n.t('admin.dashboard', { ns: 'common' }),
  },
  beforeLoad: async ({ context }) => {
    await requirePermission(context, [...DASHBOARD_SCREEN_REQUIREMENTS])
  },
  validateSearch: (raw) => dashboardSearchSchema.parse(raw),
  head: () => ({
    meta: [
      {
        title: `${i18n.t('admin.dashboard', { ns: 'common' })} - ${i18n.t('appName', { ns: 'common' })}`,
      },
    ],
  }),
  loader: async ({ context, location }) => {
    const search = dashboardSearchSchema.parse(location.search)
    const { permissions } = await loadPermissionContext(context.queryClient)
    const variant = resolveDashboardVariant(permissions) ?? 'editor'

    if (variant === 'admin') {
      await context.queryClient.ensureQueryData(
        adminDashboardQueryOptions(
          search.dossierTrendGranularity ?? 'month',
        ),
      )
    } else if (variant === 'qc') {
      await context.queryClient.ensureQueryData(qcDashboardQueryOptions())

      try {
        await context.queryClient.ensureQueryData(qcDashboardGroupQueryOptions())
      } catch (error) {
        if (!isQcGroupLeaderOnlyError(error)) {
          throw error
        }
      }
    } else {
      await context.queryClient.ensureQueryData(
        editorDashboardQueryOptions(search.period ?? '30d'),
      )
    }

    return { variant }
  },
  component: DashboardRoute,
  errorComponent: DashboardErrorComponent,
})

function DashboardRoute() {
  const { variant } = Route.useLoaderData()
  const { roleChart, dossierTrendGranularity, period } = routeApi.useSearch()

  if (variant === 'admin') {
    return (
      <AdminDashboardContent
        roleChart={roleChart ?? 'pie'}
        dossierTrendGranularity={dossierTrendGranularity ?? 'month'}
      />
    )
  }

  if (variant === 'qc') {
    return <QcDashboardContent />
  }

  return <EditorDashboardContent period={period ?? '30d'} />
}

function EditorDashboardContent({ period }: { period: EditorDashboardPeriodT }) {
  const { data, isLoading } = useQuery(editorDashboardQueryOptions(period))

  if (isLoading || !data) {
    return <DashboardLoadingState />
  }

  return <EditorDashboardPage data={data} period={period} />
}

function AdminDashboardContent({
  roleChart,
  dossierTrendGranularity,
}: {
  roleChart: AdminRoleChartTypeT
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT
}) {
  const { data, isLoading } = useQuery(
    adminDashboardQueryOptions(dossierTrendGranularity),
  )

  if (isLoading || !data) {
    return <DashboardLoadingState />
  }

  return (
    <AdminDashboardPage
      data={data}
      roleChart={roleChart}
      dossierTrendGranularity={dossierTrendGranularity}
    />
  )
}

function QcDashboardContent() {
  const overviewQuery = useQuery(qcDashboardQueryOptions())
  const groupQuery = useQuery(qcDashboardGroupQueryOptions())

  if (overviewQuery.isLoading || !overviewQuery.data) {
    return <DashboardLoadingState />
  }

  return (
    <QcDashboardPage
      overview={overviewQuery.data}
      group={groupQuery.data}
      groupError={groupQuery.error}
      isGroupLoading={groupQuery.isLoading}
    />
  )
}

function DashboardLoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function DashboardErrorComponent({
  error,
  reset,
}: {
  error: unknown
  reset: () => void
}) {
  const { t: tCommon } = useTranslation('common')
  const { t } = useTranslation('admin-dashboard')

  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="w-full max-w-lg rounded-lg border border-destructive bg-card p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-destructive">
          {tCommon('errors.defaultTitle')}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {error instanceof Error ? translateError(error) : t('errors.loadFailed')}
        </p>
        <Button onClick={reset} variant="outline">
          {tCommon('errors.tryAgain')}
        </Button>
      </div>
    </div>
  )
}
