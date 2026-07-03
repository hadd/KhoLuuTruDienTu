import type { PaperPlanRowFormValues } from '@/features/plan-management/lib/planPaperPlanRowSchema'

export function createEmptyPaperPlanRow(): PaperPlanRowFormValues {
  return {
    paperSizeName: '',
    quantity: 1,
  }
}

export function sumPaperPlanQuantities(
  paperPlans: PaperPlanRowFormValues[],
): number {
  return paperPlans.reduce((sum, row) => sum + (row.quantity || 0), 0)
}
