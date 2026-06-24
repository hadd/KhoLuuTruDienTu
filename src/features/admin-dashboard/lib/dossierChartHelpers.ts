import type {
  AdminDashboardDossierChartPointT,
  AdminDashboardDossierTrendGranularityT,
} from '@/features/admin-dashboard/types'

const MONTH_PERIOD_PATTERN = /^(\d{4})-(\d{2})$/
const QUARTER_PERIOD_PATTERN = /^(\d{4})-Q([1-4])$/

export function buildDossierTrendChartPoints(
  points: Array<AdminDashboardDossierChartPointT>,
  granularity: AdminDashboardDossierTrendGranularityT,
): Array<AdminDashboardDossierChartPointT> {
  if (granularity === 'quarter') {
    return aggregateDossierChartPointsByQuarter(points)
  }

  return points
}

function aggregateDossierChartPointsByQuarter(
  points: Array<AdminDashboardDossierChartPointT>,
): Array<AdminDashboardDossierChartPointT> {
  const totals = new Map<string, AdminDashboardDossierChartPointT>()

  for (const point of points) {
    const quarterKey = resolveQuarterPeriodKey(point.period)
    if (!quarterKey) {
      continue
    }

    const existing = totals.get(quarterKey) ?? {
      period: quarterKey,
      editedCompleted: 0,
      fullyCompleted: 0,
    }

    totals.set(quarterKey, {
      period: quarterKey,
      editedCompleted: existing.editedCompleted + point.editedCompleted,
      fullyCompleted: existing.fullyCompleted + point.fullyCompleted,
    })
  }

  return Array.from(totals.values()).sort((left, right) =>
    left.period.localeCompare(right.period),
  )
}

function resolveQuarterPeriodKey(period: string): string | null {
  const quarterMatch = period.match(QUARTER_PERIOD_PATTERN)
  if (quarterMatch) {
    return period
  }

  const monthMatch = period.match(MONTH_PERIOD_PATTERN)
  if (!monthMatch) {
    return null
  }

  const year = monthMatch[1]
  const month = Number(monthMatch[2])
  const quarter = Math.ceil(month / 3)

  return `${year}-Q${quarter}`
}

export function formatDossierChartPeriodLabel(
  period: string,
  granularity: AdminDashboardDossierTrendGranularityT,
  formatQuarter: (quarter: number, year: string) => string,
): string {
  if (granularity === 'quarter') {
    const quarterMatch = period.match(QUARTER_PERIOD_PATTERN)
    if (quarterMatch) {
      return formatQuarter(Number(quarterMatch[2]), quarterMatch[1])
    }

    const monthMatch = period.match(MONTH_PERIOD_PATTERN)
    if (monthMatch) {
      const quarter = Math.ceil(Number(monthMatch[2]) / 3)
      return formatQuarter(quarter, monthMatch[1])
    }
  }

  const monthMatch = period.match(MONTH_PERIOD_PATTERN)
  if (monthMatch) {
    return `${monthMatch[2]}/${monthMatch[1]}`
  }

  return period
}
