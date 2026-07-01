import type {
  AdminDashboardDossierStatusCountsT,
  AdminDashboardDossierStatusT,
} from '@/features/admin-dashboard/types'

export type DossierStatusCategoryT =
  | 'completed'
  | 'waitingApproval'
  | 'editing'
  | 'overdue'

export type ProjectStatusCategoryT =
  | 'completed'
  | 'running'
  | 'paused'
  | 'overdue'

const DOSSIER_STATUS_CATEGORY: Record<
  AdminDashboardDossierStatusT,
  DossierStatusCategoryT
> = {
  NEW: 'editing',
  OCR_PROCESSING: 'editing',
  OCR_FAILED: 'editing',
  READY_FOR_ENTRY: 'editing',
  ENTRY_PROCESSING: 'editing',
  WAITING_CHECKER_1: 'waitingApproval',
  CHECKER_1_PROCESSING: 'waitingApproval',
  CHECKER_1_REJECTED: 'editing',
  WAITING_CHECKER_2: 'waitingApproval',
  CHECKER_2_PROCESSING: 'waitingApproval',
  CHECKER_2_REJECTED: 'editing',
  WAITING_CHECKER_3: 'waitingApproval',
  CHECKER_3_PROCESSING: 'waitingApproval',
  CHECKER_3_REJECTED: 'editing',
  WAITING_CHECKER_4: 'waitingApproval',
  CHECKER_4_PROCESSING: 'waitingApproval',
  CHECKER_4_REJECTED: 'editing',
  WAITING_CHECKER_5: 'waitingApproval',
  CHECKER_5_PROCESSING: 'waitingApproval',
  CHECKER_5_REJECTED: 'editing',
  APPROVED: 'completed',
}

export const DOSSIER_CATEGORY_COLORS: Record<DossierStatusCategoryT, string> = {
  completed: '#3b82f6',
  waitingApproval: '#22c55e',
  editing: '#f59e0b',
  overdue: '#ef4444',
}

export const PROJECT_CATEGORY_COLORS: Record<ProjectStatusCategoryT, string> = {
  completed: '#3b82f6',
  running: '#22c55e',
  paused: '#f59e0b',
  overdue: '#ef4444',
}

export function aggregateDossierStatusCategories(
  byStatus: AdminDashboardDossierStatusCountsT,
): Record<DossierStatusCategoryT, number> {
  const totals: Record<DossierStatusCategoryT, number> = {
    completed: 0,
    waitingApproval: 0,
    editing: 0,
    overdue: 0,
  }

  for (const [status, count] of Object.entries(byStatus)) {
    if (!count) continue

    const category =
      DOSSIER_STATUS_CATEGORY[status as AdminDashboardDossierStatusT] ??
      'editing'
    totals[category] += count
  }

  return totals
}

export function aggregateProjectStatusCategories(input: {
  total: number
  completed: number
}): Record<ProjectStatusCategoryT, number> {
  const running = Math.max(0, input.total - input.completed)

  return {
    completed: input.completed,
    running,
    paused: 0,
    overdue: 0,
  }
}
