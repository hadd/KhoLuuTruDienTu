import { subDays, subMonths } from 'date-fns'

import type {
  PlanPeriodT,
  ProjectPlanT,
} from '@/features/plan-management/types'

export function getPlanPeriodStartDate(
  period: PlanPeriodT,
  referenceDate = new Date(),
): Date | null {
  if (period === 'all') {
    return null
  }

  if (period === '12m') {
    return subMonths(referenceDate, 12)
  }

  const days = Number.parseInt(period, 10)
  return subDays(referenceDate, days)
}

export function filterPlansByPeriod(
  plans: Array<ProjectPlanT>,
  period: PlanPeriodT,
  referenceDate = new Date(),
): Array<ProjectPlanT> {
  const periodStart = getPlanPeriodStartDate(period, referenceDate)
  if (!periodStart) {
    return plans
  }

  return plans.filter((plan) => {
    const planStart = new Date(plan.startDate)
    const planEnd = new Date(plan.endDate)
    return planStart <= referenceDate && planEnd >= periodStart
  })
}

export function calculatePlanDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(days, 0)
}

export type PlanSummaryStatsT = {
  totalDays: number
  totalPdfPages: number
  totalDossiers: number
}

export function computePlanSummaryStats(
  plans: Array<ProjectPlanT>,
): PlanSummaryStatsT {
  return plans.reduce<PlanSummaryStatsT>(
    (acc, plan) => ({
      totalDays:
        acc.totalDays + calculatePlanDays(plan.startDate, plan.endDate),
      totalPdfPages: acc.totalPdfPages + plan.a4Pages + plan.a3Pages,
      totalDossiers: acc.totalDossiers + plan.dossierCount,
    }),
    { totalDays: 0, totalPdfPages: 0, totalDossiers: 0 },
  )
}

export function formatRowIndex(index: number, offset = 0): string {
  return String(offset + index + 1).padStart(2, '0')
}
