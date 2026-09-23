import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPercentValue } from '@/features/admin-dashboard/components/AdminDashboardPage'
import { personalDailyKpisQueryOptions } from '@/features/dashboard/queries'
import type { PersonalDailyKpiT } from '@/features/dashboard/types'
import {
  needsEditorDashboardData,
  needsQcDashboardData,
} from '@/features/permissions/lib/dashboardAccess'
import { useCurrentLanguage } from '@/lib/hooks/useCurrentLanguage'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/date'
import { formatNumber } from '@/lib/utils/format'

type PersonalKpiPeriodT = 'today' | '7d' | '30d' | 'month' | 'quarter' | 'custom'

type PersonalKpiTableProps = {
  permissions: Array<string>
  hidden?: Array<string>
}

function formatDateStr(date: Date) {
  return date.toISOString().split('T')[0]
}

function resolvePeriodRange(
  period: PersonalKpiPeriodT,
  customFrom = '',
  customTo = '',
) {
  const today = new Date()
  if (period === 'today') {
    const value = formatDateStr(today)
    return { dateFrom: value, dateTo: value }
  }
  if (period === '7d') {
    const past = new Date(today)
    past.setDate(past.getDate() - 7)
    return { dateFrom: formatDateStr(past), dateTo: formatDateStr(today) }
  }
  if (period === 'month') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    return { dateFrom: formatDateStr(startOfMonth), dateTo: formatDateStr(today) }
  }
  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3
    const startOfQuarter = new Date(today.getFullYear(), quarterStartMonth, 1)
    return {
      dateFrom: formatDateStr(startOfQuarter),
      dateTo: formatDateStr(today),
    }
  }
  if (period === 'custom') {
    return { dateFrom: customFrom, dateTo: customTo }
  }
  const past = new Date(today)
  past.setDate(past.getDate() - 30)
  return { dateFrom: formatDateStr(past), dateTo: formatDateStr(today) }
}

export function PersonalKpiTable({
  permissions,
  hidden = [],
}: PersonalKpiTableProps) {
  const { t } = useTranslation('admin-dashboard')
  const language = useCurrentLanguage()
  const showMaker = needsEditorDashboardData(permissions, hidden)
  const showQc = needsQcDashboardData(permissions, hidden)

  const [period, setPeriod] = useState<PersonalKpiPeriodT>('30d')
  const initialRange = resolvePeriodRange('30d')
  const [dateFrom, setDateFrom] = useState(initialRange.dateFrom)
  const [dateTo, setDateTo] = useState(initialRange.dateTo)

  const { data, isLoading, isFetching } = useQuery(
    personalDailyKpisQueryOptions(dateFrom || undefined, dateTo || undefined),
  )

  const days = data?.days ?? []
  const total = data?.total
  const colSpan = 1 + (showMaker ? 3 : 0) + (showQc ? 3 : 0) + 3

  const handlePeriodChange = (
    nextPeriod: PersonalKpiPeriodT,
    customFrom?: string,
    customTo?: string,
  ) => {
    setPeriod(nextPeriod)
    const range = resolvePeriodRange(
      nextPeriod,
      customFrom !== undefined ? customFrom : dateFrom,
      customTo !== undefined ? customTo : dateTo,
    )
    if (nextPeriod === 'custom') {
      if (customFrom !== undefined) setDateFrom(customFrom)
      if (customTo !== undefined) setDateTo(customTo)
      return
    }
    setDateFrom(range.dateFrom)
    setDateTo(range.dateTo)
  }

  const volumeGroups = useMemo(
    () =>
      [
        showMaker
          ? {
              key: 'maker' as const,
              title: t('employeeKpi.groups.maker'),
              headerClass:
                'text-center font-bold border-l border-r bg-blue-50/60 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 py-1.5',
              rateClass: 'text-blue-600 dark:text-blue-400',
            }
          : null,
        showQc
          ? {
              key: 'qc' as const,
              title: t('employeeKpi.groups.qc'),
              headerClass:
                'text-center font-bold border-r bg-indigo-50/60 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 py-1.5',
              rateClass: 'text-indigo-600 dark:text-indigo-400',
            }
          : null,
      ].filter((group) => group !== null),
    [showMaker, showQc, t],
  )

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-4 border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              {t('personalKpi.title')}
              {isFetching ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {t('personalKpi.description')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={period}
              onValueChange={(value) =>
                handlePeriodChange(value as PersonalKpiPeriodT)
              }
            >
              <SelectTrigger
                className="h-8 w-[140px] text-xs"
                aria-label={t('employeeKpi.periodLabel')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{t('employeeKpi.period.today')}</SelectItem>
                <SelectItem value="7d">{t('employeeKpi.period.7d')}</SelectItem>
                <SelectItem value="30d">{t('employeeKpi.period.30d')}</SelectItem>
                <SelectItem value="month">{t('employeeKpi.period.month')}</SelectItem>
                <SelectItem value="quarter">
                  {t('employeeKpi.period.quarter')}
                </SelectItem>
                <SelectItem value="custom">
                  {t('employeeKpi.period.custom')}
                </SelectItem>
              </SelectContent>
            </Select>
            {period === 'custom' ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) =>
                    handlePeriodChange('custom', event.target.value, dateTo)
                  }
                  className="h-8 w-[140px] text-xs"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) =>
                    handlePeriodChange('custom', dateFrom, event.target.value)
                  }
                  className="h-8 w-[140px] text-xs"
                />
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2} className="w-[140px] align-middle">
                {t('personalKpi.columns.date')}
              </TableHead>
              {volumeGroups.map((group) => (
                <TableHead key={group.key} colSpan={3} className={group.headerClass}>
                  {group.title}
                </TableHead>
              ))}
              <TableHead rowSpan={2} className="text-center align-middle">
                {t('personalKpi.columns.avgTime')}
              </TableHead>
              <TableHead rowSpan={2} className="text-center align-middle">
                {t('personalKpi.columns.rejected')}
              </TableHead>
              <TableHead rowSpan={2} className="text-right align-middle">
                {t('employeeKpi.columns.accuracyRate')}
              </TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent border-b bg-muted/20">
              {volumeGroups.flatMap((group) => [
                <TableHead
                  key={`${group.key}-dossier`}
                  className="text-center border-l border-r text-xs font-medium py-1.5 w-[145px]"
                >
                  {t('employeeKpi.columns.dossierCount')}
                </TableHead>,
                <TableHead
                  key={`${group.key}-file`}
                  className="text-center border-r text-xs font-semibold py-1.5 w-[145px]"
                >
                  {t('employeeKpi.columns.fileCount')}
                </TableHead>,
                <TableHead
                  key={`${group.key}-page`}
                  className="text-center border-r text-xs font-medium py-1.5 w-[145px]"
                >
                  {t('employeeKpi.columns.pageCount')}
                </TableHead>,
              ])}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && days.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : days.length > 0 ? (
              days.map((row) => (
                <PersonalKpiRow
                  key={row.date}
                  row={row}
                  showMaker={showMaker}
                  showQc={showQc}
                  dateLabel={formatDate(row.date, 'PP', language)}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="h-24 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertTriangle className="size-5 text-muted-foreground/60" />
                    <span>{t('personalKpi.empty')}</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {total ? (
            <TableFooter>
              <PersonalKpiRow
                row={total}
                showMaker={showMaker}
                showQc={showQc}
                dateLabel={t('personalKpi.total')}
                isTotal
              />
            </TableFooter>
          ) : null}
        </Table>
      </CardContent>
    </Card>
  )
}

function PersonalKpiRow({
  row,
  showMaker,
  showQc,
  dateLabel,
  isTotal = false,
}: {
  row: PersonalDailyKpiT
  showMaker: boolean
  showQc: boolean
  dateLabel: string
  isTotal?: boolean
}) {
  const { t } = useTranslation('admin-dashboard')
  const badgeStyle = getAccuracyBadgeStyle(row.accuracyRate)

  return (
    <TableRow className={cn(isTotal && 'bg-muted/40 font-semibold hover:bg-muted/40')}>
      <TableCell>
        <span className={cn('text-xs', isTotal ? 'font-semibold' : 'font-medium')}>
          {dateLabel}
        </span>
      </TableCell>
      {showMaker ? (
        <>
          <VolumeCell
            completed={row.makerCompletedDossiersCount}
            assigned={row.makerAssignedDossiersCount}
            rate={row.makerDossierCompletionRate}
            unit="HS"
            rateClass="text-blue-600 dark:text-blue-400"
            className="border-l border-r"
          />
          <VolumeCell
            completed={row.makerCompletedFilesCount}
            assigned={row.makerAssignedFilesCount}
            rate={row.makerFileCompletionRate}
            unit="file"
            rateClass="text-blue-600 dark:text-blue-400"
            className="border-r"
          />
          <VolumeCell
            completed={row.makerCompletedPagesCount}
            assigned={row.makerAssignedPagesCount}
            rate={row.makerPageCompletionRate}
            unit="tr"
            rateClass="text-blue-600 dark:text-blue-400"
            className="border-r"
          />
        </>
      ) : null}
      {showQc ? (
        <>
          <VolumeCell
            completed={row.qcCompletedDossiersCount}
            assigned={row.qcAssignedDossiersCount}
            rate={row.qcDossierCompletionRate}
            unit="HS"
            rateClass="text-indigo-600 dark:text-indigo-400"
            className="border-r bg-muted/10"
          />
          <VolumeCell
            completed={row.qcCompletedFilesCount}
            assigned={row.qcAssignedFilesCount}
            rate={row.qcFileCompletionRate}
            unit="file"
            rateClass="text-indigo-600 dark:text-indigo-400"
            className="border-r bg-muted/10"
          />
          <VolumeCell
            completed={row.qcCompletedPagesCount}
            assigned={row.qcAssignedPagesCount}
            rate={row.qcPageCompletionRate}
            unit="tr"
            rateClass="text-indigo-600 dark:text-indigo-400"
            className="border-r bg-muted/10"
          />
        </>
      ) : null}
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground font-medium">
          <Clock className="size-3 text-muted-foreground" />
          <span>
            {t('personalKpi.columns.minutes', {
              count: row.avgProcessingTimeMinutes ?? 0,
            })}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {(row.rejectedDossiersCount ?? 0) > 0 ? (
          <Badge
            variant="outline"
            className="text-[11px] px-2 py-0.5 bg-rose-50 text-rose-700 border-rose-200 font-semibold dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
          >
            {t('personalKpi.columns.rejectedCount', {
              count: row.rejectedDossiersCount,
            })}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Badge variant={badgeStyle.variant} className={`text-xs px-2 py-0.5 ${badgeStyle.className}`}>
            {formatPercentValue(row.accuracyRate, 1)}
          </Badge>
        </div>
      </TableCell>
    </TableRow>
  )
}

function VolumeCell({
  completed,
  assigned,
  rate,
  unit,
  rateClass,
  className,
}: {
  completed: number
  assigned: number
  rate: number
  unit: string
  rateClass: string
  className?: string
}) {
  return (
    <TableCell className={className}>
      <div className="flex flex-col gap-1 w-[135px] mx-auto">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {formatNumber(completed, { maximumFractionDigits: 0 })} /{' '}
            {formatNumber(assigned, { maximumFractionDigits: 0 })} {unit}
          </span>
          <span className={cn('text-[11px] font-semibold', rateClass)}>
            {formatPercentValue(rate, 1)}
          </span>
        </div>
        <Progress value={Math.min(100, rate)} className="h-1.5 bg-muted" />
      </div>
    </TableCell>
  )
}

function getAccuracyBadgeStyle(accuracyRate: number) {
  if (accuracyRate >= 95) {
    return {
      variant: 'outline' as const,
      className:
        'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    }
  }
  if (accuracyRate >= 80) {
    return {
      variant: 'outline' as const,
      className:
        'bg-amber-50 text-amber-700 border-amber-300 font-semibold dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    }
  }
  return {
    variant: 'outline' as const,
    className:
      'bg-rose-50 text-rose-700 border-rose-200 font-semibold dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
  }
}
