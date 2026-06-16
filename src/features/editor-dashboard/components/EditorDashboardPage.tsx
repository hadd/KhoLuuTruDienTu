import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Target,
  Timer,
  XCircle,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getRouteApi } from '@tanstack/react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  formatDurationSeconds,
  formatPercentValue,
} from '@/features/admin-dashboard/components/AdminDashboardPage'
import type {
  EditorDashboardPeriodT,
  EditorDashboardT,
} from '@/features/editor-dashboard/types'
import { formatNumber } from '@/lib/utils/format'

const COMPLETED_BAR_COLOR = '#22c55e'

const ACCURACY_CHART_COLORS = {
  correct: '#22c55e',
  incorrect: '#ef4444',
} as const

const EDITOR_PERIODS: Array<EditorDashboardPeriodT> = [
  '7d',
  '30d',
  '90d',
  '12m',
]

const dashboardRouteApi = getRouteApi('/app/dashboard/')

type EditorDashboardPageProps = {
  data: EditorDashboardT
  period: EditorDashboardPeriodT
}

export function EditorDashboardPage({ data, period }: EditorDashboardPageProps) {
  const { t } = useTranslation('editor-dashboard')
  const navigate = dashboardRouteApi.useNavigate()

  const completedChartData = useMemo(() => {
    if (data.completedTrend.length > 0) {
      return data.completedTrend.map((point, index) => ({
        key: `${point.label}-${index}`,
        name: point.label,
        value: point.count,
      }))
    }

    if (data.completed > 0) {
      return [
        {
          key: 'completed-total',
          name: t('chart.completedInPeriod'),
          value: data.completed,
        },
      ]
    }

    return []
  }, [data.completed, data.completedTrend, t])

  const accuracyChartData = useMemo(
    () => [
      {
        key: 'correct',
        name: t('chart.correct'),
        value: data.accuracy.correct,
        fill: ACCURACY_CHART_COLORS.correct,
      },
      {
        key: 'incorrect',
        name: t('chart.incorrect'),
        value: data.accuracy.incorrect,
        fill: ACCURACY_CHART_COLORS.incorrect,
      },
    ],
    [data.accuracy.correct, data.accuracy.incorrect, t],
  )

  const hasAccuracyData =
    data.accuracy.correct > 0 || data.accuracy.incorrect > 0

  const hasCompletedChartData = completedChartData.length > 0

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-foreground">
            {t('sections.overview.title')}
          </h2>
          <Select
            value={period}
            onValueChange={(value) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  period: value as EditorDashboardPeriodT,
                }),
              })
            }}
          >
            <SelectTrigger className="w-[180px]" aria-label={t('filter.periodLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITOR_PERIODS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`filter.periods.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            icon={ClipboardList}
            label={t('sections.overview.totalAssigned')}
            value={formatNumber(data.totalAssigned, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={CheckCircle2}
            label={t('sections.overview.completed')}
            value={formatNumber(data.completed, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={Clock3}
            label={t('sections.overview.inProgress')}
            value={formatNumber(data.inProgress, { maximumFractionDigits: 0 })}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.accuracy.title')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            icon={CheckCircle2}
            label={t('sections.accuracy.correct')}
            value={formatNumber(data.accuracy.correct, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={XCircle}
            label={t('sections.accuracy.incorrect')}
            value={formatNumber(data.accuracy.incorrect, { maximumFractionDigits: 0 })}
          />
          <KpiCard
            icon={Target}
            label={t('sections.accuracy.rate')}
            value={formatPercentValue(data.accuracy.rate)}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">
          {t('sections.performance.title')}
        </h2>
        <KpiCard
          icon={Timer}
          label={t('sections.performance.avgProcessingTime')}
          value={formatDurationSeconds(data.avgProcessingTimeSeconds)}
        />
      </section>

      {hasCompletedChartData || hasAccuracyData ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {hasCompletedChartData ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.overview.title')}</CardTitle>
                <CardDescription>
                  {t('chart.completedInPeriod')}:{' '}
                  {formatNumber(data.completed, { maximumFractionDigits: 0 })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completedChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar
                        dataKey="value"
                        name={t('chart.completed')}
                        fill={COMPLETED_BAR_COLOR}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {hasAccuracyData ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.accuracy.title')}</CardTitle>
                <CardDescription>
                  {formatPercentValue(data.accuracy.rate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accuracyChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={64}
                        outerRadius={96}
                        paddingAngle={2}
                      >
                        {accuracyChartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}
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
