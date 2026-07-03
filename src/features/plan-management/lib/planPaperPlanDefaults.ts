import type { PaperPlanRowFormValues } from '@/features/plan-management/lib/planPaperPlanRowSchema'

export function normalizePaperSizeName(name: string): string {
  return name.trim().toLowerCase()
}

export function getSelectedPaperSizeNames(
  paperPlans: Array<PaperPlanRowFormValues>,
  excludeIndex?: number,
): Set<string> {
  const selected = new Set<string>()

  paperPlans.forEach((row, index) => {
    if (index === excludeIndex) {
      return
    }

    const normalized = normalizePaperSizeName(row.paperSizeName)
    if (normalized) {
      selected.add(normalized)
    }
  })

  return selected
}

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
