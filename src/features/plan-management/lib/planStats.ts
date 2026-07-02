import type { ProjectPlanDetailItemT } from '@/features/plan-management/types'

export function calculatePlanDaysFromRange(
  startDate: string,
  endDate: string,
): number {
  if (!startDate || !endDate || endDate < startDate) {
    return 0
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffMs = end.getTime() - start.getTime()
  return Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0)
}

export function sumPlanDetailQuantities(
  items: Array<ProjectPlanDetailItemT>,
): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}
