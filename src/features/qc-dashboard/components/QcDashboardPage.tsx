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
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  formatDurationSeconds,
  formatPercentValue,
} from '@/features/admin-dashboard/components/AdminDashboardPage'
import type {
  QcDashboardGroupT,
  QcDashboardT,
  QcCheckerRoleT,
} from '@/features/qc-dashboard/types'
import { isQcGroupLeaderOnlyError } from '@/features/qc-dashboard/lib/loadErrors'
import { formatNumber } from '@/lib/utils/format'
import { translateError } from '@/lib/utils/translate-error'

const STATUS_CHART_COLORS = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
} as const

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

  const stepStatusChartData = useMemo(() => {
    const totals = overview.byStep.reduce(
      (acc, item) => ({
        approved: acc.approved + item.approved,
        rejected: acc.rejected + item.rejected,
        pending: acc.pending + item.pending,
      }),
      { approved: 0, rejected: 0, pending: 0 },
    )

    return [
      {
        key: 'approved',
        name: t('chart.approved'),
        value: totals.approved,
        fill: STATUS_CHART_COLORS.approved,
      },
      {
        key: 'pending',
        name: t('chart.pending'),
        value: totals.pending,
        fill: STATUS_CHART_COLORS.pending,
      },
      {
        key: 'rejected',
        name: t('chart.rejected'),
        value: totals.rejected,
        fill: STATUS_CHART_COLORS.rejected,
      },
    ].filter((item) => item.value > 0)
  }, [overview.byStep, t])

  const totalStepVolume = stepStatusChartData.reduce((sum, item) => sum + item.value, 0)

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
          {t('sections.efficiency.title')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            icon={CheckCircle2}
            label={t('sections.efficiency.approvalRate')}
            value={formatPercentValue(overview.efficiency.approvalRate)}
          />
          <KpiCard
            icon={XCircle}
            label={t('sections.efficiency.rejectionRate')}
            value={formatPercentValue(overview.efficiency.rejectionRate)}
          />
        </div>
      </section>

      {overview.byStep.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">
            {t('sections.byStep.title')}
          </h2>
          {stepStatusChartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('sections.byStep.title')}</CardTitle>
                <CardDescription>{t('sections.byStep.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stepStatusChartData}
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
                        {stepStatusChartData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          formatNumber(Number(value ?? 0), { maximumFractionDigits: 0 })
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {formatNumber(totalStepVolume, { maximumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

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

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.group.editors')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {group.editors.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('table.columns.name')}</TableHead>
                          <TableHead>{t('table.columns.completed')}</TableHead>
                          <TableHead>{t('table.columns.inProgress')}</TableHead>
                          <TableHead>{t('table.columns.correctRate')}</TableHead>
                          <TableHead>{t('table.columns.avgProcessingTime')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.editors.map((editor) => (
                          <TableRow key={editor.userId}>
                            <TableCell>{editor.fullName}</TableCell>
                            <TableCell>{editor.completed}</TableCell>
                            <TableCell>{editor.inProgress}</TableCell>
                            <TableCell>{formatPercentValue(editor.correctRate)}</TableCell>
                            <TableCell>
                              {formatDurationSeconds(editor.avgProcessingTimeSeconds)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.group.qcMembers')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {group.qcMembers.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('table.columns.name')}</TableHead>
                          <TableHead>{t('table.columns.role')}</TableHead>
                          <TableHead>{t('table.columns.reviewed')}</TableHead>
                          <TableHead>{t('table.columns.approved')}</TableHead>
                          <TableHead>{t('table.columns.approvalRate')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.qcMembers.map((member) => (
                          <TableRow key={member.userId}>
                            <TableCell>{member.fullName}</TableCell>
                            <TableCell>
                              {t(`roles.${member.role}` as `roles.${QcCheckerRoleT}`)}
                            </TableCell>
                            <TableCell>{member.reviewed}</TableCell>
                            <TableCell>{member.approved}</TableCell>
                            <TableCell>{formatPercentValue(member.approvalRate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('table.empty')}</p>
                  )}
                </CardContent>
              </Card>
            </div>
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
