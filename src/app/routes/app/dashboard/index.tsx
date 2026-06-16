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
import type { AppRoleT } from '@/features/auth/constants'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import { EditorDashboardPage } from '@/features/editor-dashboard/components/EditorDashboardPage'
import { editorDashboardQueryOptions } from '@/features/editor-dashboard/queries'
import type { EditorDashboardPeriodT } from '@/features/editor-dashboard/types'
import { QcDashboardPage } from '@/features/qc-dashboard/components/QcDashboardPage'
import {
  qcDashboardGroupQueryOptions,
  qcDashboardQueryOptions,
} from '@/features/qc-dashboard/queries'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

const dashboardSearchSchema = z.object({
  roleChart: z
    .enum(['pie', 'bar', 'line', 'horizontalBar'])
    .optional()
    .catch('pie' satisfies AdminRoleChartTypeT),
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
    const role = getDashboardRole()

    if (role === 'admin') {
      await context.queryClient.ensureQueryData(adminDashboardQueryOptions())
    } else if (role === 'qc') {
      await Promise.all([
        context.queryClient.ensureQueryData(qcDashboardQueryOptions()),
        context.queryClient.ensureQueryData(qcDashboardGroupQueryOptions()),
      ])
    } else {
      await context.queryClient.ensureQueryData(
        editorDashboardQueryOptions(search.period ?? '30d'),
      )
    }

    return { role }
  },
  component: DashboardRoute,
  errorComponent: DashboardErrorComponent,
})

function getDashboardRole(): AppRoleT {
  return getPrimaryAppRole(getUserRoles()) ?? 'editor'
}

function DashboardRoute() {
  const { role } = Route.useLoaderData()
  const { roleChart, period } = routeApi.useSearch()

  if (role === 'admin') {
    return <AdminDashboardContent roleChart={roleChart ?? 'pie'} />
  }

  if (role === 'qc') {
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
}: {
  roleChart: AdminRoleChartTypeT
}) {
  const { data, isLoading } = useQuery(adminDashboardQueryOptions())

  if (isLoading || !data) {
    return <DashboardLoadingState />
  }

  return <AdminDashboardPage data={data} roleChart={roleChart} />
}

function QcDashboardContent() {
  const overviewQuery = useQuery(qcDashboardQueryOptions())
  const groupQuery = useQuery(qcDashboardGroupQueryOptions())

  if (
    overviewQuery.isLoading ||
    groupQuery.isLoading ||
    !overviewQuery.data ||
    !groupQuery.data
  ) {
    return <DashboardLoadingState />
  }

  return (
    <QcDashboardPage overview={overviewQuery.data} group={groupQuery.data} />
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
  const role = getDashboardRole()
  const namespace =
    role === 'qc'
      ? 'qc-dashboard'
      : role === 'editor'
        ? 'editor-dashboard'
        : 'admin-dashboard'
  const { t } = useTranslation(namespace)
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="rounded-lg border border-destructive bg-card p-8 text-center">
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
  )
}
