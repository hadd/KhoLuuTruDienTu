import { getRouteApi } from '@tanstack/react-router'
import {
  Activity,
  CheckCircle2,
  Clock3,
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
  Area,
  AreaChart,
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
import type {
  AdminDashboardActivityT,
  AdminDashboardGroupStatsT,
  AdminDashboardT,
} from '@/features/admin-dashboard/types'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { formatDate, formatRelativeTime } from '@/lib/utils/date'
import { formatNumber } from '@/lib/utils/format'

const ROLE_CHART_COLORS = {
  admin: '#3b82f6',
  editor: '#10b981',
  qc: '#f59e0b',
} as const

const GROUP_BAR_COLORS = {
  totalDossiers: '#6366f1',
  approved: '#22c55e',
} as const

const QUALITY_BAR_COLORS = {
  progressRate: '#6366f1',
  avgEditorCorrectRate: '#10b981',
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

export function AdminDashboardPage({ data, roleChart }: AdminDashboardPageProps) {
  const { t } = useTranslation('admin-dashboard')
  const language = useCurrentLanguage()
  const navigate = dashboardRouteApi.useNavigate()

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

  const groupDossierData = useMemo(
    () =>
      data.groups.map((group) => ({
        name: group.name,
        totalDossiers: group.totalDossiers,
        approved: group.approved,
      })),
    [data.groups],
  )

  const hasDossierComparison = useMemo(
    () =>
      groupDossierData.some(
        (item) => item.totalDossiers > 0 || item.approved > 0,
      ),
    [groupDossierData],
  )

  const groupQualityData = useMemo(
    () =>
      data.groups.map((group) => ({
        name: group.name,
        progressRate: normalizePercent(group.progressRate),
        avgEditorCorrectRate: normalizePercent(group.avgEditorCorrectRate),
        avgQcApprovalRate: normalizePercent(group.avgQcApprovalRate),
      })),
    [data.groups],
  )

  const ocrTrendData = useMemo(() => {
    if (data.ocrActivityTrend.length > 0) {
      return data.ocrActivityTrend.map((point) => ({
        label: point.label,
        count: point.count,
      }))
    }

    return buildOcrTrendFromActivities(data.recentActivities)
  }, [data.ocrActivityTrend, data.recentActivities])

  const totalRoleUsers = roleChartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.overview.title')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={Users}
            label={t('sections.overview.totalActiveUsers')}
            value={formatNumber(data.totalActiveUsers, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.totalActiveUsers })}
          />
          <KpiCard
            icon={UsersRound}
            label={t('sections.overview.totalGroups')}
            value={formatNumber(data.totalGroups, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={ShieldCheck}
            label={t('roles.admin')}
            value={formatNumber(data.byRole.admin, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.byRole.admin })}
          />
          <KpiCard
            icon={UserCog}
            label={t('roles.editor')}
            value={formatNumber(data.byRole.editor, { maximumFractionDigits: 0 })}
            description={t('metrics.count', { count: data.byRole.editor })}
          />
          <KpiCard
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
            <CardContent className="grid gap-4 sm:grid-cols-1">
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
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.groups.title')}
        </h2>
        {hasDossierComparison ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.groups.dossierComparison')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupDossierData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="totalDossiers"
                      name={t('chart.totalDossiers')}
                      fill={GROUP_BAR_COLORS.totalDossiers}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="approved"
                      name={t('chart.approved')}
                      fill={GROUP_BAR_COLORS.approved}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {data.groups.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.groups.qualityMetrics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupQualityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatPercentValue(Number(value ?? 0))
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey="progressRate"
                        name={t('sections.groups.columns.progressRate')}
                        fill={QUALITY_BAR_COLORS.progressRate}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="avgEditorCorrectRate"
                        name={t('sections.groups.columns.avgEditorCorrectRate')}
                        fill={QUALITY_BAR_COLORS.avgEditorCorrectRate}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="avgQcApprovalRate"
                        name={t('sections.groups.columns.avgQcApprovalRate')}
                        fill={QUALITY_BAR_COLORS.avgQcApprovalRate}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('sections.groups.qualityTable')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupQualityTable groups={data.groups} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.activity.title')}
        </h2>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.activity.ocrTrend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ocrTrendData}>
                    <defs>
                      <linearGradient id="ocrTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name={t('chart.ocrCompleted')}
                      stroke="#3b82f6"
                      fill="url(#ocrTrendFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-72 flex-col">
            <CardHeader>
              <CardTitle>{t('sections.activity.timeline')}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ActivityTimeline
                activities={data.recentActivities}
                language={language}
                emptyLabel={t('sections.activity.empty')}
              />
            </CardContent>
          </Card>
        </div>
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

type KpiCardProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  description?: string
}

function KpiCard({ icon: Icon, label, value, description }: KpiCardProps) {
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

type KpiInlineProps = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}

function KpiInline({ icon: Icon, label, value }: KpiInlineProps) {
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

function GroupQualityTable({ groups }: { groups: Array<AdminDashboardGroupStatsT> }) {
  const { t } = useTranslation('admin-dashboard')

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('sections.activity.empty')}</p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('sections.groups.columns.group')}</TableHead>
          <TableHead className="text-right">
            {t('sections.groups.columns.progressRate')}
          </TableHead>
          <TableHead className="text-right">
            {t('sections.groups.columns.avgEditorCorrectRate')}
          </TableHead>
          <TableHead className="text-right">
            {t('sections.groups.columns.avgQcApprovalRate')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.id ?? group.name}>
            <TableCell className="font-medium">{group.name}</TableCell>
            <TableCell className="text-right">
              {formatPercentValue(group.progressRate)}
            </TableCell>
            <TableCell className="text-right">
              {formatPercentValue(group.avgEditorCorrectRate)}
            </TableCell>
            <TableCell className="text-right">
              {formatPercentValue(group.avgQcApprovalRate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type ActivityTimelineProps = {
  activities: Array<AdminDashboardActivityT>
  language: 'en' | 'vi'
  emptyLabel: string
}

function ActivityTimeline({
  activities,
  language,
  emptyLabel,
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {activities.slice(0, 10).map((activity) => (
        <div
          key={activity.id}
          className="flex gap-3 rounded-md border border-border bg-card p-3"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Activity className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{activity.dossierCode}</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {activity.action}
              </span>
            </div>
            {activity.groupName ? (
              <p className="mt-1 text-xs text-muted-foreground">{activity.groupName}</p>
            ) : null}
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" />
              <span title={formatDate(activity.createdAt, 'PPpp', language)}>
                {formatRelativeTime(activity.createdAt, language)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function buildOcrTrendFromActivities(activities: Array<AdminDashboardActivityT>) {
  const ocrActivities = activities.filter(
    (activity) => activity.action === 'OCR_COMPLETED',
  )

  const buckets = new Map<string, number>()

  for (const activity of ocrActivities) {
    const date = new Date(activity.createdAt)
    const label = Number.isNaN(date.getTime())
      ? activity.createdAt
      : `${String(date.getHours()).padStart(2, '0')}:00`

    buckets.set(label, (buckets.get(label) ?? 0) + 1)
  }

  return Array.from(buckets.entries()).map(([label, count]) => ({
    label,
    count,
  }))
}

export function formatDurationSeconds(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizePercent(value: number): number {
  if (value <= 1) {
    return Math.round(value * 100)
  }

  return Math.round(value)
}

export function formatPercentValue(value: number): string {
  return `${formatNumber(normalizePercent(value), { maximumFractionDigits: 0 })}%`
}
