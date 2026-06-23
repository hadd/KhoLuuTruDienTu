import { getRouteApi } from '@tanstack/react-router'
import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Database,
  FolderKanban,
  ShieldCheck,
  Timer,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  aggregateDossierStatusCategories,
  aggregateProjectStatusCategories,
  DOSSIER_CATEGORY_COLORS,
  PROJECT_CATEGORY_COLORS,
} from '@/features/admin-dashboard/lib/dashboardStatusHelpers'
import type { AdminDashboardT } from '@/features/admin-dashboard/types'
import { formatNumber } from '@/lib/utils/format'

const ROLE_CHART_COLORS = {
  admin: '#3b82f6',
  editor: '#10b981',
  qc: '#f59e0b',
} as const

const GROUP_BAR_COLORS = {
  progressRate: '#3b82f6',
  avgEditorCorrectRate: '#22c55e',
  avgQcApprovalRate: '#f59e0b',
} as const

export type AdminRoleChartTypeT = 'pie' | 'bar' | 'line' | 'horizontalBar'

const ROLE_CHART_TYPES: Array<AdminRoleChartTypeT> = [
  'pie',
  'bar',
  'line',
  'horizontalBar',
]

const dashboardRouteApi = getRouteApi('/app/dashboard/')

type AdminDashboardPageProps = {
  data: AdminDashboardT
  roleChart: AdminRoleChartTypeT
}

type ChartDatumT = {
  key: string
  name: string
  value: number
  fill: string
}

const RADIAN = Math.PI / 180

export function AdminDashboardPage({ data, roleChart }: AdminDashboardPageProps) {
  const { t } = useTranslation('admin-dashboard')
  const navigate = dashboardRouteApi.useNavigate()

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
    const { hours, minutes } = formatLongDurationParts(data.avgProcessingTimeSeconds)
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

  const totalRoleUsers = roleChartData.reduce((sum, item) => sum + item.value, 0)

  const groupChartData = useMemo(
    () =>
      data.groups.map((group) => ({
        name: group.name,
        progressRate: normalizePercentValue(group.progressRate),
        avgEditorCorrectRate: normalizePercentValue(group.avgEditorCorrectRate),
        avgQcApprovalRate: normalizePercentValue(group.avgQcApprovalRate),
      })),
    [data.groups],
  )

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <SummaryStatCard
          icon={Database}
          title={t('summary.systemDossiers.title')}
          value={formatNumber(data.systemDossiers.total, { maximumFractionDigits: 0 })}
          subtitle={t('summary.systemDossiers.completed', {
            count: formatNumber(data.systemDossiers.completed, {
              maximumFractionDigits: 0,
            }),
          })}
          footer={t('summary.systemDossiers.footer', {
            completion: formatPercentValue(data.systemDossiers.completionRate, 1),
            accuracy: formatPercentValue(data.systemDossiers.accuracyRate, 1),
          })}
        />
        <SummaryStatCard
          icon={Briefcase}
          title={t('summary.systemProjects.title')}
          value={formatNumber(data.systemProjects.total, { maximumFractionDigits: 0 })}
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
          footer={t('summary.performance.footer', { duration: avgDurationLabel })}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t('charts.dossierStatus.title')}</CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label={t('charts.dossierStatus.dateFrom')}
              className="w-[150px]"
            />
            <Input
              type="date"
              aria-label={t('charts.dossierStatus.dateTo')}
              className="w-[150px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <StatusDonutChart data={dossierStatusChartData} emptyLabel={t('table.empty')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t('charts.projects.title')}</CardTitle>
          </div>
          <Select defaultValue="all" disabled>
            <SelectTrigger className="w-[180px]" aria-label={t('charts.projects.title')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('charts.projects.scopeAll')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <StatusDonutChart data={projectStatusChartData} emptyLabel={t('table.empty')} />
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.overview.title')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <OverviewKpiCard
            icon={Users}
            label={t('sections.overview.totalActiveUsers')}
            value={formatNumber(data.totalActiveUsers, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.totalActiveUsers })}
          />
          <OverviewKpiCard
            icon={UsersRound}
            label={t('sections.overview.totalGroups')}
            value={formatNumber(data.totalGroups, { maximumFractionDigits: 0 })}
          />
          <OverviewKpiCard
            icon={ShieldCheck}
            label={t('roles.admin')}
            value={formatNumber(data.byRole.admin, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.byRole.admin })}
          />
          <OverviewKpiCard
            icon={UserCog}
            label={t('roles.editor')}
            value={formatNumber(data.byRole.editor, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.byRole.editor })}
          />
          <OverviewKpiCard
            icon={CheckCircle2}
            label={t('roles.qc')}
            value={formatNumber(data.byRole.qc, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.byRole.qc })}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{t('sections.overview.roleDistribution')}</CardTitle>
                <CardDescription>
                  {t('metrics.count', { count: totalRoleUsers })}
                </CardDescription>
              </div>
              <Select
                value={roleChart}
                onValueChange={(value) => {
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      roleChart: value as AdminRoleChartTypeT,
                    }),
                  })
                }}
              >
                <SelectTrigger className="w-[160px]" aria-label={t('chart.typeLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_CHART_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`chart.types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <RoleDistributionChart data={roleChartData} chartType={roleChart} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sections.performance.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
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
        </div>
      </section>

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
          <CardContent className="pt-6">
            {groupChartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChartData} margin={{ bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value) => formatPercentValue(Number(value ?? 0))}
                    />
                    <Legend />
                    <Bar
                      dataKey="progressRate"
                      name={t('chart.groups.progressRate')}
                      fill={GROUP_BAR_COLORS.progressRate}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="avgEditorCorrectRate"
                      name={t('chart.groups.avgEditorCorrectRate')}
                      fill={GROUP_BAR_COLORS.avgEditorCorrectRate}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="avgQcApprovalRate"
                      name={t('chart.groups.avgQcApprovalRate')}
                      fill={GROUP_BAR_COLORS.avgQcApprovalRate}
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
      </section>
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
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="h-80">
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
  const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, name = '', percent = 0 } = props
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
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="mt-5 rounded-lg bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary">
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
      <CardContent className="flex items-start gap-4 p-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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
