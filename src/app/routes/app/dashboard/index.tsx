// @/features/dashboard/routes/index.tsx (Hoặc tệp tin cấu hình tuyến đường dashboard chính của bạn)

import { useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { LayoutDashboard, Loader2, Warehouse } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react' // Thêm useEffect và useMemo
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AdminRoleChartTypeT } from '@/features/admin-dashboard/components/AdminDashboardPage'
import { AdminDashboardPage } from '@/features/admin-dashboard/components/AdminDashboardPage'
import { adminDashboardQueryOptions } from '@/features/admin-dashboard/queries'
import type { AdminDashboardDossierTrendGranularityT } from '@/features/admin-dashboard/types'
import { loadPermissionContext } from '@/features/auth/lib/permission-access'
import { requirePermission } from '@/features/auth/routeGuards'
import { EditorDashboardPage } from '@/features/editor-dashboard/components/EditorDashboardPage'
import { editorDashboardQueryOptions } from '@/features/editor-dashboard/queries'
import type { EditorDashboardPeriodT } from '@/features/editor-dashboard/types'
import {
  DASHBOARD_SCREEN_REQUIREMENTS,
  resolveDashboardVariant,
} from '@/features/permissions/lib/dashboardAccess'
import { QcDashboardPage } from '@/features/qc-dashboard/components/QcDashboardPage'
import { isQcGroupLeaderOnlyError } from '@/features/qc-dashboard/lib/loadErrors'
import {
  qcDashboardGroupQueryOptions,
  qcDashboardQueryOptions,
} from '@/features/qc-dashboard/queries'
import { WarehouseDashboard } from '@/features/warehouse-dashboard'
import { warehouseDashboardQueries } from '@/features/warehouse-dashboard/queries'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'
import { WarehouseDashboardIntakeGranularityT } from '@/features/warehouse-dashboard/types'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'

const dashboardSearchSchema = z.object({
  tab: z.enum(['overview', 'warehouse']).optional().catch('overview'),
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
    intakeGranularity: z // Bổ sung cấu hình search param để đồng bộ hóa granular biểu đồ kho
    .enum(['day', 'month'])
    .optional()
    .catch('month' satisfies WarehouseDashboardIntakeGranularityT),
})

export type DashboardSearchT = z.infer<typeof dashboardSearchSchema>

// Helper kiểm tra quyền kho và xác định priority cho Overview
function checkDashboardPermissions(permissions: string[]) {
  const variant = resolveDashboardVariant(permissions)
  const hasWarehouse = isPermissionGranted(permissions, 'dashboard.warehouse', 'dashboard')

  const hasOverviewAccess =
    variant === 'admin' || variant === 'qc' || variant === 'editor'

  const overviewVariant: 'admin' | 'qc' | 'editor' =
    hasOverviewAccess && variant ? variant : 'editor'

  return {
    overviewVariant,
    hasOverviewAccess,
    hasWarehouseAccess: hasWarehouse,
    isWarehouseOnly: hasWarehouse && !hasOverviewAccess,
  }
}

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
    const permInfo = checkDashboardPermissions(permissions)

    const targetTab = permInfo.isWarehouseOnly ? 'warehouse' : search.tab ?? 'overview'

    try {
      if (targetTab === 'warehouse' && permInfo.hasWarehouseAccess) {
        await context.queryClient.ensureQueryData(
          warehouseDashboardQueries.warehouseStats(search.intakeGranularity ?? 'month'),
        )
      } else if (permInfo.hasOverviewAccess) {
        if (permInfo.overviewVariant === 'admin') {
          await context.queryClient.ensureQueryData(
            adminDashboardQueryOptions(search.dossierTrendGranularity ?? 'month'),
          )
        } else if (permInfo.overviewVariant === 'qc') {
          await context.queryClient.ensureQueryData(qcDashboardQueryOptions())
          try {
            await context.queryClient.ensureQueryData(qcDashboardGroupQueryOptions())
          } catch (error) {
            if (!isQcGroupLeaderOnlyError(error)) throw error
          }
        } else if (permInfo.overviewVariant === 'editor') {
          await context.queryClient.ensureQueryData(
            editorDashboardQueryOptions(search.period ?? '30d'),
          )
        }
      }
    } catch (error) {
      console.warn('Dashboard prefetching failed safely:', error)
    }

    return { permissions }
  },
  component: DashboardRoute,
  errorComponent: DashboardErrorComponent,
})

function DashboardRoute() {
  const { permissions } = Route.useLoaderData()
  const navigate = routeApi.useNavigate()
  const { tab, roleChart, dossierTrendGranularity, period } = routeApi.useSearch()

  const { overviewVariant, hasOverviewAccess, hasWarehouseAccess, isWarehouseOnly } = useMemo(
    () => checkDashboardPermissions(permissions),
    [permissions],
  )

  const activeTab = isWarehouseOnly ? 'warehouse' : (tab ?? 'overview')
  const showTabSelector = hasOverviewAccess && hasWarehouseAccess

  // Đồng bộ param tab lên URL nếu người dùng chỉ có duy nhất quyền kho
  useEffect(() => {
    if (isWarehouseOnly && tab !== 'warehouse') {
      void navigate({
        search: (prev) => ({ ...prev, tab: 'warehouse' }),
        replace: true,
      })
    }
  }, [isWarehouseOnly, tab, navigate])

  return (
    <div className="flex flex-1 flex-col gap-4 w-full h-full min-h-0">
      {/* Header đồng bộ có chuyển Tab */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {activeTab === 'warehouse'
              ? 'Dashboard Báo Cáo & Vận Hành Kho'
              : 'Tổng Quan Hệ Thống'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {activeTab === 'warehouse'
              ? 'Theo dõi dữ liệu thực tế về sức chứa kho vật lý, kho dữ liệu số và hồ sơ lưu trữ'
              : 'Thống kê tổng quan tiến độ số hóa, quy trình làm việc và hiệu suất toàn hệ thống'}
          </p>
        </div>

        {showTabSelector ? (
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  tab: val as 'overview' | 'warehouse',
                }),
              })
            }}
            className="w-auto"
          >
            <TabsList className="h-9 p-1">
              <TabsTrigger value="overview" className="h-7 text-xs gap-1.5 px-3">
                <LayoutDashboard className="size-3.5" />
                <span>Tổng Quan Hệ Thống</span>
              </TabsTrigger>
              <TabsTrigger value="warehouse" className="h-7 text-xs gap-1.5 px-3">
                <Warehouse className="size-3.5" />
                <span>Dashboard Kho</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {/* Nội dung Dashboard */}
      {activeTab === 'warehouse' ? (
        <WarehouseDashboard />
      ) : overviewVariant === 'admin' ? (
        <AdminDashboardContent
          roleChart={roleChart ?? 'pie'}
          dossierTrendGranularity={dossierTrendGranularity ?? 'month'}
        />
      ) : overviewVariant === 'qc' ? (
        <QcDashboardContent />
      ) : (
        <EditorDashboardContent period={period ?? '30d'} />
      )}
    </div>
  )
}


function EditorDashboardContent({
  period,
}: {
  period: EditorDashboardPeriodT
}) {
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
          {error instanceof Error
            ? translateError(error)
            : t('errors.loadFailed')}
        </p>
        <Button onClick={reset} variant="outline">
          {tCommon('errors.tryAgain')}
        </Button>
      </div>
    </div>
  )
}