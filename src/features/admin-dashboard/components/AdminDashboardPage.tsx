import { getRouteApi } from '@tanstack/react-router'
import {
  ArrowUpDown,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FolderKanban,
  Search,
  ShieldCheck,
  Timer,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmployeeKpiTable } from './EmployeeKpiTable'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  aggregateDossierStatusCategories,
  aggregateProjectStatusCategories,
  DOSSIER_CATEGORY_COLORS,
  PROJECT_CATEGORY_COLORS,
} from '@/features/admin-dashboard/lib/dashboardStatusHelpers'
import {
  buildDossierTrendChartPoints,
  formatDossierChartPeriodLabel,
} from '@/features/admin-dashboard/lib/dossierChartHelpers'
import type {
  AdminDashboardDossierTrendGranularityT,
  AdminDashboardEmployeeKpiT,
  AdminDashboardT,
} from '@/features/admin-dashboard/types'
import { DASHBOARD_ADMIN_SUB_PERMISSIONS } from '@/features/permissions/lib/dashboardAccess'
import { isPermissionGranted } from '@/features/permissions/lib/permissionRules'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate } from '@/lib/utils/date'
import { formatNumber } from '@/lib/utils/format'

const ROLE_CHART_COLORS = {
  admin: '#3b82f6',
  editor: '#10b981',
  qc: '#f59e0b',
} as const

const GROUP_EDITOR_CORRECT_RATE_COLOR = '#22c55e'

const DOSSIER_TREND_COLORS = {
  editedCompleted: '#3b82f6',
  fullyCompleted: '#22c55e',
} as const

const GROUP_VOLUME_COLORS = {
  totalDossiers: '#6366f1',
  approved: '#22c55e',
} as const

export type AdminRoleChartTypeT = 'pie' | 'bar' | 'line' | 'horizontalBar'

const ROLE_CHART_TYPES: Array<AdminRoleChartTypeT> = [
  'pie',
  'bar',
  'line',
  'horizontalBar',
]

const DOSSIER_TREND_GRANULARITIES: Array<AdminDashboardDossierTrendGranularityT> =
  ['month', 'quarter']

const dashboardRouteApi = getRouteApi('/app/dashboard/')

type AdminDashboardPageProps = {
  data: AdminDashboardT
  roleChart: AdminRoleChartTypeT
  dossierTrendGranularity: AdminDashboardDossierTrendGranularityT
  permissions?: Array<string>
}

type ChartDatumT = {
  key: string
  name: string
  value: number
  fill: string
}

const RADIAN = Math.PI / 180

export function AdminDashboardPage({
  data,
  roleChart,
  dossierTrendGranularity,
  permissions = [],
}: AdminDashboardPageProps) {
  const { t } = useTranslation('admin-dashboard')
  const language = useCurrentLanguage()
  const navigate = dashboardRouteApi.useNavigate()

  const canViewSummary = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.summary,
    'dashboard',
  )
  const canViewDossierStatus = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.dossierStatusChart,
    'dashboard',
  )
  const canViewProjectStatus = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.projectStatusChart,
    'dashboard',
  )
  const canViewDossierTrend = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.dossierTrendChart,
    'dashboard',
  )
  const canViewSystemPerformance = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.systemPerformance,
    'dashboard',
  )
  const canViewEmployeeKpis = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.employeeKpis,
    'dashboard',
  )
  const canViewGroupPerformance = isPermissionGranted(
    permissions,
    DASHBOARD_ADMIN_SUB_PERMISSIONS.groupPerformanceChart,
    'dashboard',
  )

  const hasAnySubSectionPermission =
    canViewSummary ||
    canViewDossierStatus ||
    canViewProjectStatus ||
    canViewDossierTrend ||
    canViewSystemPerformance ||
    canViewEmployeeKpis ||
    canViewGroupPerformance

  const dossierCategoryTotals = useMemo(
    () => aggregateDossierStatusCategories(data.byStatus),
    [data.byStatus],
  )

  const dossierStatusChartData = useMemo(
    () =>
      buildCategoryChartData(
        dossierCategoryTotals,
        t,
        'charts.statusCategories',
        DOSSIER_CATEGORY_COLORS,
      ),
    [dossierCategoryTotals, t],
  )

  const projectCategoryTotals = useMemo(
    () =>
      aggregateProjectStatusCategories({
        total: data.systemProjects.total,
        completed: data.systemProjects.completed,
      }),
    [data.systemProjects.completed, data.systemProjects.total],
  )

  const projectStatusChartData = useMemo(
    () =>
      buildCategoryChartData(
        projectCategoryTotals,
        t,
        'charts.statusCategories',
        PROJECT_CATEGORY_COLORS,
      ),
    [projectCategoryTotals, t],
  )

  const avgDurationLabel = useMemo(() => {
    const { hours, minutes } = formatLongDurationParts(
      data.avgProcessingTimeSeconds,
    )
    return t('metrics.hoursMinutes', { hours, minutes })
  }, [data.avgProcessingTimeSeconds, t])

  const roleChartData = useMemo(
    () => [
      {
        key: 'admin',
        name: t('roles.admin'),
        value: data.byRole.admin,
        fill: ROLE_CHART_COLORS.admin,
      },
      {
        key: 'editor',
        name: t('roles.editor'),
        value: data.byRole.editor,
        fill: ROLE_CHART_COLORS.editor,
      },
      {
        key: 'qc',
        name: t('roles.qc'),
        value: data.byRole.qc,
        fill: ROLE_CHART_COLORS.qc,
      },
    ],
    [data.byRole, t],
  )

  const totalRoleUsers = roleChartData.reduce(
    (sum, item) => sum + item.value,
    0,
  )

  const dossierTrendChartData = useMemo(() => {
    const points = buildDossierTrendChartPoints(
      data.dossierChart.points,
      dossierTrendGranularity,
    )

    return points.map((point) => ({
      name: formatDossierChartPeriodLabel(
        point.period,
        dossierTrendGranularity,
        (quarter, year) =>
          t('charts.dossierTrend.quarterLabel', { quarter, year }),
      ),
      editedCompleted: point.editedCompleted,
      fullyCompleted: point.fullyCompleted,
    }))
  }, [data.dossierChart.points, dossierTrendGranularity, t])

  const dossierTrendRangeLabel = useMemo(() => {
    const { rangeStart, rangeEnd } = data.dossierChart
    if (!rangeStart || !rangeEnd) {
      return null
    }

    return t('charts.dossierTrend.description', {
      from: formatDate(rangeStart, 'dd/MM/yyyy', language),
      to: formatDate(rangeEnd, 'dd/MM/yyyy', language),
    })
  }, [data.dossierChart, language, t])

  const groupPerformanceChartData = useMemo(
    () =>
      data.groups.map((group) => ({
        name: group.name,
        totalDossiers: group.totalDossiers,
        approved: group.approved,
        avgEditorCorrectRate: normalizePercentValue(group.avgEditorCorrectRate),
      })),
    [data.groups],
  )

  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {!hasAnySubSectionPermission ? (
        <div className="flex flex-1 items-center justify-center py-16 text-center border rounded-lg bg-card p-8">
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {t('errors.noPermissionTitle')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('errors.noPermissionDescription')}
            </p>
          </div>
        </div>
      ) : null}

      {/* Thẻ thống kê tổng quan */}
      {canViewSummary ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <SummaryStatCard
            icon={Database}
            title={t('summary.systemDossiers.title')}
            value={formatNumber(data.systemDossiers.total, {
              maximumFractionDigits: 0,
            })}
            subtitle={t('summary.systemDossiers.completed', {
              count: formatNumber(data.systemDossiers.completed, {
                maximumFractionDigits: 0,
              }),
            })}
            footer={t('summary.systemDossiers.footer', {
              completion: formatPercentValue(
                data.systemDossiers.completionRate,
                1,
              ),
              accuracy: formatPercentValue(data.systemDossiers.accuracyRate, 1),
            })}
          />
          <SummaryStatCard
            icon={Briefcase}
            title={t('summary.systemProjects.title')}
            value={formatNumber(data.systemProjects.total, {
              maximumFractionDigits: 0,
            })}
            subtitle={t('summary.systemProjects.completed', {
              count: formatNumber(data.systemProjects.completed, {
                maximumFractionDigits: 0,
              }),
            })}
            footer={t('summary.systemProjects.footer', {
              rate: formatPercentValue(data.systemProjects.completionRate, 1),
            })}
          />
          <SummaryStatCard
            icon={ClipboardList}
            title={t('summary.performance.title')}
            value={formatPercentValue(data.overallApprovalRate, 1)}
            subtitle={t('summary.performance.approvedThisWeek', {
              count: formatNumber(data.dossiersApprovedThisWeek, {
                maximumFractionDigits: 0,
              }),
            })}
            footer={t('summary.performance.footer', {
              duration: avgDurationLabel,
            })}
          />
        </section>
      ) : null}

      {/* Row 1: Donut/Pie Charts */}
      {canViewDossierStatus || canViewProjectStatus ? (
        <section className={`grid gap-4 grid-cols-1 ${canViewDossierStatus && canViewProjectStatus ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {canViewDossierStatus ? (
            <Card className="flex flex-col justify-between">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">{t('charts.dossierStatus.title')}</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    aria-label={t('charts.dossierStatus.dateFrom')}
                    className="h-8 w-[130px] text-xs"
                  />
                  <Input
                    type="date"
                    aria-label={t('charts.dossierStatus.dateTo')}
                    className="h-8 w-[130px] text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <StatusDonutChart
                  data={dossierStatusChartData}
                  emptyLabel={t('table.empty')}
                />
              </CardContent>
            </Card>
          ) : null}

          {canViewProjectStatus ? (
            <Card className="flex flex-col justify-between">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">{t('charts.projects.title')}</CardTitle>
                </div>
                <Select defaultValue="all" disabled>
                  <SelectTrigger
                    className="h-8 w-[140px] text-xs"
                    aria-label={t('charts.projects.title')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('charts.projects.scopeAll')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="flex-1">
                <StatusDonutChart
                  data={projectStatusChartData}
                  emptyLabel={t('table.empty')}
                />
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* Row 2: Biểu đồ cột & Hiệu suất hệ thống */}
      {canViewDossierTrend || canViewSystemPerformance ? (
        <section className="grid gap-4 grid-cols-1 lg:grid-cols-12">
          {canViewDossierTrend ? (
            <Card className={`${canViewSystemPerformance ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col justify-between`}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">{t('charts.dossierTrend.title')}</CardTitle>
                  {dossierTrendRangeLabel ? (
                    <CardDescription className="text-xs">{dossierTrendRangeLabel}</CardDescription>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={dossierTrendGranularity}
                    onValueChange={(value) => {
                      void navigate({
                        search: (prev) => ({
                          ...prev,
                          dossierTrendGranularity:
                            value as AdminDashboardDossierTrendGranularityT,
                        }),
                      })
                    }}
                  >
                    <SelectTrigger
                      className="h-8 w-[140px] text-xs"
                      aria-label={t('charts.dossierTrend.granularityLabel')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOSSIER_TREND_GRANULARITIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {t(`charts.dossierTrend.granularity.${item}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {dossierTrendChartData.length > 0 ? (
                  <div className="h-72 min-w-0 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dossierTrendChartData} margin={{ bottom: 8 }}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) =>
                            formatNumber(Number(value ?? 0), {
                              maximumFractionDigits: 0,
                            })
                          }
                        />
                        <Legend />
                        <Bar
                          dataKey="editedCompleted"
                          name={t('charts.dossierTrend.editedCompleted')}
                          fill={DOSSIER_TREND_COLORS.editedCompleted}
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="fullyCompleted"
                          name={t('charts.dossierTrend.fullyCompleted')}
                          fill={DOSSIER_TREND_COLORS.fullyCompleted}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    {t('table.empty')}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {canViewSystemPerformance ? (
            <Card className={`${canViewDossierTrend ? 'lg:col-span-4' : 'lg:col-span-12'} flex flex-col justify-between`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{t('sections.performance.title')}</CardTitle>
                <CardDescription className="text-xs">Chỉ số thời gian và tỷ lệ duyệt toàn hệ thống</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 flex-1 flex-col justify-center">
                <KpiInline
                  icon={Timer}
                  label={t('sections.performance.avgProcessingTime')}
                  value={formatDurationSeconds(data.avgProcessingTimeSeconds)}
                />
                <KpiInline
                  icon={CheckCircle2}
                  label={t('sections.performance.overallApprovalRate')}
                  value={formatPercentValue(data.overallApprovalRate)}
                />
                <KpiInline
                  icon={FolderKanban}
                  label={t('sections.performance.dossiersApprovedToday')}
                  value={formatNumber(data.dossiersApprovedToday, {
                    maximumFractionDigits: 0,
                  })}
                />
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* Row 3: Biểu đồ KPI của từng nhân viên (dạng bảng) */}
      {canViewEmployeeKpis ? (
        <EmployeeKpiTable data={data.employeeKpis} />
      ) : null}

      {/* Row 4: Biểu đồ hiệu suất tổ nhóm */}
      {canViewGroupPerformance ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">
              {t('sections.groups.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('sections.groups.description')}
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t('charts.groupVolume.title')}</CardTitle>
              <CardDescription>
                {t('charts.groupVolume.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupPerformanceChartData.length > 0 ? (
                <div className="h-80 min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={groupPerformanceChartData}
                      margin={{ bottom: 8 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-24}
                        textAnchor="end"
                        height={72}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        formatter={(value, _name, item) => {
                          if (item?.dataKey === 'avgEditorCorrectRate') {
                            return formatPercentValue(Number(value ?? 0))
                          }
                          return formatNumber(Number(value ?? 0), {
                            maximumFractionDigits: 0,
                          })
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="totalDossiers"
                        name={t('charts.groupVolume.totalDossiers')}
                        fill={GROUP_VOLUME_COLORS.totalDossiers}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="approved"
                        name={t('charts.groupVolume.approved')}
                        fill={GROUP_VOLUME_COLORS.approved}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgEditorCorrectRate"
                        name={t('chart.groups.avgEditorCorrectRate')}
                        stroke={GROUP_EDITOR_CORRECT_RATE_COLOR}
                        strokeWidth={2}
                        dot={{ r: 4, fill: GROUP_EDITOR_CORRECT_RATE_COLOR }}
                        activeDot={{ r: 6 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t('table.empty')}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}

type RoleChartDatumT = {
  key: string
  name: string
  value: number
  fill: string
}

function RoleDistributionChart({
  data,
  chartType,
}: {
  data: Array<RoleChartDatumT>
  chartType: AdminRoleChartTypeT
}) {
  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={96}
            paddingAngle={2}
            label={({ name, percent }) =>
              `${name} ${Math.round((percent ?? 0) * 100)}%`
            }
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#64748b"
            strokeWidth={2}
            dot={{ r: 4, fill: '#64748b' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === 'horizontalBar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={72}
            tick={{ fontSize: 12 }}
          />
          <Tooltip />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function buildCategoryChartData<T extends string>(
  totals: Record<T, number>,
  t: (key: string) => string,
  translationPrefix: string,
  colors: Record<T, string>,
): Array<ChartDatumT> {
  return (Object.entries(totals) as Array<[T, number]>)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key,
      name: t(`${translationPrefix}.${key}`),
      value,
      fill: colors[key] ?? '#64748b',
    }))
}

function StatusDonutChart({
  data,
  emptyLabel,
}: {
  data: Array<ChartDatumT>
  emptyLabel: string
}) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
              <div className="h-80 min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={72}
            outerRadius={108}
            paddingAngle={2}
            label={renderDonutLabel}
            labelLine
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              formatNumber(Number(value ?? 0), { maximumFractionDigits: 0 })
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function renderDonutLabel(props: {
  cx?: number
  cy?: number
  midAngle?: number
  outerRadius?: number
  name?: string
  percent?: number
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    name = '',
    percent = 0,
  } = props
  const radius = outerRadius + 28
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="fill-foreground text-xs"
    >
      {`${name} ${Math.round(percent * 100)}%`}
    </text>
  )
}

type SummaryStatCardProps = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: string
  subtitle: string
  footer: string
}

function SummaryStatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  footer,
}: SummaryStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          {footer}
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewKpiCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  description?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">{value}</p>
          {description ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function KpiInline({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-4">
      <Icon className="size-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function formatDurationSeconds(totalSeconds: number): string {
  const { hours, minutes, seconds } = formatLongDurationParts(totalSeconds)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatLongDurationParts(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  return {
    hours: Math.floor(safeSeconds / 3600),
    minutes: Math.floor((safeSeconds % 3600) / 60),
    seconds: safeSeconds % 60,
  }
}

function normalizePercentValue(value: number): number {
  if (value <= 1) {
    return Math.round(value * 100)
  }

  return Math.round(value)
}

function normalizePercent(value: number): number {
  if (value <= 1) {
    return value * 100
  }

  return value
}

export function formatPercentValue(
  value: number,
  maximumFractionDigits = 0,
): string {
  return `${formatNumber(normalizePercent(value), { maximumFractionDigits })}%`
}
