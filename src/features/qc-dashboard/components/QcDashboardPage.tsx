import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FolderKanban,
  Loader2,
  ShieldOff,
  Timer,
  XCircle,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
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
import { formatPercentValue } from '@/features/admin-dashboard/components/AdminDashboardPage'
import type {
  QcDashboardGroupT,
  QcDashboardT,
} from '@/features/qc-dashboard/types'
import { isQcGroupLeaderOnlyError } from '@/features/qc-dashboard/lib/loadErrors'
import { formatNumber } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

const STATUS_CHART_COLORS = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
} as const

const EFFICIENCY_BAR_COLORS = {
  approvalRate: '#22c55e',
  rejectionRate: '#ef4444',
} as const

const EDITOR_CHART_COLORS = {
  completed: '#3b82f6',
  inProgress: '#f59e0b',
  correctRate: '#22c55e',
} as const

const QC_TREND_BAR_COLOR = '#6366f1'

const EDITOR_CHART_BAR_WIDTH = 56
const EDITOR_CHART_SCROLL_THRESHOLD = 10
const TREND_ROW_HEIGHT = 36

function normalizePercent(value: number): number {
  if (value <= 1) {
    return Math.round(value * 100)
  }

  return Math.round(value)
}

type QcDashboardPageProps = {
  overview: QcDashboardT
  group?: QcDashboardGroupT
  groupError?: unknown
  isGroupLoading?: boolean
}

export function QcDashboardPage({
  overview,
  group,
  groupError,
  isGroupLoading = false,
}: QcDashboardPageProps) {
  const { t } = useTranslation('qc-dashboard')

  const stepByLevelChartData = useMemo(
    () =>
      overview.byStep.map((item) => ({
        name: t('chart.stepLevel', { step: item.step }),
        approved: item.approved,
        rejected: item.rejected,
        pending: item.pending,
      })),
    [overview.byStep, t],
  )

  const hasStepChartData = useMemo(
    () =>
      stepByLevelChartData.some(
        (item) => item.approved > 0 || item.rejected > 0 || item.pending > 0,
      ),
    [stepByLevelChartData],
  )

  const efficiencyChartData = useMemo(
    () => [
      {
        key: 'approvalRate',
        name: t('sections.efficiency.approvalRate'),
        value: normalizePercent(overview.efficiency.approvalRate),
        fill: EFFICIENCY_BAR_COLORS.approvalRate,
      },
      {
        key: 'rejectionRate',
        name: t('sections.efficiency.rejectionRate'),
        value: normalizePercent(overview.efficiency.rejectionRate),
        fill: EFFICIENCY_BAR_COLORS.rejectionRate,
      },
    ],
    [overview.efficiency.approvalRate, overview.efficiency.rejectionRate, t],
  )

  const editorChartData = useMemo(
    () =>
      [...(group?.editors ?? [])]
        .map((editor) => ({
          name: editor.fullName,
          completed: editor.completed,
          inProgress: editor.inProgress,
          correctRate: normalizePercent(editor.correctRate),
        }))
        .sort(
          (left, right) =>
            right.completed + right.inProgress - (left.completed + left.inProgress),
        ),
    [group?.editors],
  )

  const dossierTrendData = useMemo(
    () => group?.processingTrend ?? [],
    [group?.processingTrend],
  )

  const peakProcessingDay = useMemo(() => {
    if (dossierTrendData.length === 0) return null

    return dossierTrendData.reduce((peak, point) =>
      point.count > peak.count ? point : peak,
    )
  }, [dossierTrendData])

  const editorChartMinWidth = Math.max(
    editorChartData.length * EDITOR_CHART_BAR_WIDTH,
    640,
  )

  const trendChartHeight = Math.max(dossierTrendData.length * TREND_ROW_HEIGHT, 240)

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={ClipboardList}
            label={t('sections.overview.totalAssigned')}
            value={formatNumber(overview.totalAssigned, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={CheckCircle2}
            label={t('sections.overview.approved')}
            value={formatNumber(overview.approved, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={XCircle}
            label={t('sections.overview.rejected')}
            value={formatNumber(overview.rejected, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={Clock3}
            label={t('sections.overview.reviewed')}
            value={formatNumber(overview.reviewed, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={FolderKanban}
            label={t('sections.overview.pending')}
            value={formatNumber(overview.pending, { maximumFractionDigits: 0 })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.byStep.title')}
        </h2>
        <div
          className={
            hasStepChartData ? 'grid gap-4 xl:grid-cols-2' : 'grid gap-4'
          }
        >
          {hasStepChartData ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.byStep.title')}</CardTitle>
                <CardDescription>{t('sections.byStep.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stepByLevelChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) =>
                          formatNumber(Number(value ?? 0), { maximumFractionDigits: 0 })
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey="approved"
                        name={t('chart.approved')}
                        fill={STATUS_CHART_COLORS.approved}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="rejected"
                        name={t('chart.rejected')}
                        fill={STATUS_CHART_COLORS.rejected}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="pending"
                        name={t('chart.pending')}
                        fill={STATUS_CHART_COLORS.pending}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className={hasStepChartData ? undefined : 'max-w-xl'}>
            <CardHeader>
              <CardTitle>{t('sections.efficiency.title')}</CardTitle>
              <CardDescription>{t('sections.efficiency.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={efficiencyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value) =>
                        formatPercentValue(Number(value ?? 0) / 100)
                      }
                    />
                    <Legend />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {efficiencyChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">
            {t('sections.group.title')}
          </h2>
          {group ? (
            <p className="mt-1 text-sm text-muted-foreground">{group.groupName}</p>
          ) : null}
        </div>

        {isGroupLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : group ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={FolderKanban}
                label={t('sections.group.totalDossiers')}
                value={formatNumber(group.totalDossiers, { maximumFractionDigits: 0 })}
              />
              <KpiCard
                icon={CheckCircle2}
                label={t('sections.group.approved')}
                value={formatNumber(group.approved, { maximumFractionDigits: 0 })}
              />
              <KpiCard
                icon={Clock3}
                label={t('sections.group.inProgress')}
                value={formatNumber(group.inProgress, { maximumFractionDigits: 0 })}
              />
              <KpiCard
                icon={Timer}
                label={t('sections.group.progressRate')}
                value={formatPercentValue(group.progressRate)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('sections.group.distribution')}</CardTitle>
                <CardDescription>
                  {t('sections.group.distributionDescription', {
                    total: formatNumber(group.totalDossiers, {
                      maximumFractionDigits: 0,
                    }),
                  })}
                  {peakProcessingDay ? (
                    <>
                      {' · '}
                      {t('sections.group.distributionPeakDay', {
                        label: peakProcessingDay.label,
                        count: formatNumber(peakProcessingDay.count, {
                          maximumFractionDigits: 0,
                        }),
                      })}
                    </>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dossierTrendData.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto">
                    <div style={{ height: trendChartHeight }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dossierTrendData}
                          layout="vertical"
                          margin={{ left: 8, right: 16, bottom: 8 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border"
                          />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 12 }}
                            label={{
                              value: t('chart.processingCount'),
                              position: 'insideBottom',
                              offset: -4,
                              style: { fontSize: 12, fill: 'var(--muted-foreground)' },
                            }}
                          />
                          <YAxis
                            type="category"
                            dataKey="label"
                            width={72}
                            tick={{ fontSize: 11 }}
                            label={{
                              value: t('chart.processingDay'),
                              angle: -90,
                              position: 'insideLeft',
                              style: { fontSize: 12, fill: 'var(--muted-foreground)' },
                            }}
                          />
                          <Tooltip
                            formatter={(value) =>
                              formatNumber(Number(value ?? 0), {
                                maximumFractionDigits: 0,
                              })
                            }
                            labelFormatter={(label) =>
                              `${t('chart.processingDay')}: ${label}`
                            }
                          />
                          <Bar
                            dataKey="count"
                            name={t('chart.processingCount')}
                            fill={QC_TREND_BAR_COLOR}
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('sections.group.editors')}</CardTitle>
                {editorChartData.length > EDITOR_CHART_SCROLL_THRESHOLD ? (
                  <CardDescription>{t('chart.scrollHint')}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent>
                {editorChartData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="h-80" style={{ minWidth: editorChartMinWidth }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={editorChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
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
                              if (item?.dataKey === 'correctRate') {
                                return formatPercentValue(Number(value ?? 0) / 100)
                              }
                              return formatNumber(Number(value ?? 0), {
                                maximumFractionDigits: 0,
                              })
                            }}
                          />
                          <Legend />
                          <Bar
                            yAxisId="left"
                            dataKey="completed"
                            name={t('chart.completed')}
                            fill={EDITOR_CHART_COLORS.completed}
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            yAxisId="left"
                            dataKey="inProgress"
                            name={t('chart.inProgress')}
                            fill={EDITOR_CHART_COLORS.inProgress}
                            radius={[4, 4, 0, 0]}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="correctRate"
                            name={t('chart.correctRate')}
                            stroke={EDITOR_CHART_COLORS.correctRate}
                            strokeWidth={2}
                            dot={{ r: 4, fill: EDITOR_CHART_COLORS.correctRate }}
                            activeDot={{ r: 6 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card variant="detail">
            <CardContent className="flex flex-col items-center gap-3 px-8 py-10 text-center">
              <ShieldOff className="size-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {groupError && isQcGroupLeaderOnlyError(groupError)
                  ? t('errors.groupLeaderOnly')
                  : groupError
                    ? translateError(groupError)
                    : t('errors.loadFailed')}
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
