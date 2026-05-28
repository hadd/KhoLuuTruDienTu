import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type { DataDossierStatus } from '@/features/data-management/types'

/** Statuses where the assigned checker can still edit, approve, add/delete fields. */
const CHECKER_EDITABLE_STATUSES: Record<number, Array<DataDossierStatus>> = {
  1: ['WAITING_CHECKER_1', 'CHECKER_1_PROCESSING', 'CHECKER_1_REJECTED'],
  2: ['WAITING_CHECKER_2', 'CHECKER_2_PROCESSING', 'CHECKER_2_REJECTED'],
  3: ['WAITING_CHECKER_3', 'CHECKER_3_PROCESSING', 'CHECKER_3_REJECTED'],
  4: ['WAITING_CHECKER_4', 'CHECKER_4_PROCESSING', 'CHECKER_4_REJECTED'],
  5: ['WAITING_CHECKER_5', 'CHECKER_5_PROCESSING', 'CHECKER_5_REJECTED'],
}

export function getCheckerLevelForRole(role: DataManagementRole): number | null {
  if (role === 'qc') return 1
  return null
}

export function canCheckerEditDossier(
  dossierStatus: DataDossierStatus | undefined,
  checkerLevel: number,
): boolean {
  if (!dossierStatus) return false
  const editableStatuses = CHECKER_EDITABLE_STATUSES[checkerLevel]
  if (!editableStatuses) return false
  return editableStatuses.includes(dossierStatus)
}

export function canManageDossierMetadata({
  role,
  dossierStatus,
  baseCanManage,
}: {
  role: DataManagementRole
  dossierStatus?: DataDossierStatus
  baseCanManage: boolean
}): boolean {
  if (!baseCanManage) return false

  const checkerLevel = getCheckerLevelForRole(role)
  if (checkerLevel == null) return baseCanManage

  return canCheckerEditDossier(dossierStatus, checkerLevel)
}
