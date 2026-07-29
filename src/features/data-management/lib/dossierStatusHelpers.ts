import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { canEditDossierMetadataSummary } from '@/features/data-management/lib/dossierMetadataAccess'
import type { DataDossierStatus } from '@/features/data-management/types'

/** Statuses where the assigned checker can still edit, approve, add/delete fields. */
const CHECKER_EDITABLE_STATUSES: Record<number, Array<DataDossierStatus>> = {
  1: ['WAITING_CHECKER_1', 'CHECKER_1_PROCESSING', 'CHECKER_1_REJECTED'],
  2: ['WAITING_CHECKER_2', 'CHECKER_2_PROCESSING', 'CHECKER_2_REJECTED'],
  3: ['WAITING_CHECKER_3', 'CHECKER_3_PROCESSING', 'CHECKER_3_REJECTED'],
  4: ['WAITING_CHECKER_4', 'CHECKER_4_PROCESSING', 'CHECKER_4_REJECTED'],
  5: ['WAITING_CHECKER_5', 'CHECKER_5_PROCESSING', 'CHECKER_5_REJECTED'],
}

export function getCheckerLevelForDossierStatus(
  dossierStatus: DataDossierStatus | undefined,
): number | null {
  if (!dossierStatus) return null
  for (const [level, statuses] of Object.entries(CHECKER_EDITABLE_STATUSES)) {
    if (statuses.includes(dossierStatus)) {
      return Number(level)
    }
  }
  return null
}

export function getCheckerLevelForRole(
  role: DataManagementRole,
  dossierStatus?: DataDossierStatus,
): number | null {
  if (role !== 'qc') return null
  return getCheckerLevelForDossierStatus(dossierStatus)
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

/** QC chỉ được duyệt/từ chối khi bước hiện tại trùng cấp được phân công. */
export function canQcSubmitAtAssignedLevel({
  dossierStatus,
  assignedCheckerLevel,
}: {
  dossierStatus?: DataDossierStatus
  assignedCheckerLevel?: number
}): boolean {
  if (assignedCheckerLevel == null) return false
  const statusLevel = getCheckerLevelForDossierStatus(dossierStatus)
  if (statusLevel == null) return false
  return statusLevel === assignedCheckerLevel
}

export function canExportDossierMetadata(
  dossierStatus: DataDossierStatus | undefined,
): boolean {
  return dossierStatus === 'APPROVED'
}

/** Approved dossiers are locked — metadata is view-only for every role. */
export function isDossierMetadataLocked(
  dossierStatus: DataDossierStatus | undefined,
): boolean {
  return dossierStatus === 'APPROVED'
}

const EDITOR_WORKABLE_ASSIGNMENT_STATUSES = new Set([
  'IN_PROGRESS',
  'DRAFT',
])

/** Editor may save/submit metadata only while their assignment is still workable. */
export function canEditorSubmitMetadata({
  assignmentStatus,
}: {
  assignmentStatus?: string
  dossierStatus?: DataDossierStatus
}): boolean {
  if (!assignmentStatus?.trim()) return true
  return EDITOR_WORKABLE_ASSIGNMENT_STATUSES.has(assignmentStatus.trim())
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
  if (isDossierMetadataLocked(dossierStatus)) return false
  if (role !== 'qc') return baseCanManage

  const checkerLevel = getCheckerLevelForDossierStatus(dossierStatus)
  if (checkerLevel == null) return false

  return canCheckerEditDossier(dossierStatus, checkerLevel)
}

export function canEditRecordSummaryFields({
  permissions,
  dossierStatus,
  managementRole,
  assignedCheckerLevel,
}: {
  permissions: Array<string>
  dossierStatus?: DataDossierStatus
  managementRole: DataManagementRole
  assignedCheckerLevel?: number
}): boolean {
  if (!canEditDossierMetadataSummary(permissions)) return false
  if (isDossierMetadataLocked(dossierStatus)) return false

  if (managementRole === 'qc') {
    if (assignedCheckerLevel == null) return false
    return canCheckerEditDossier(dossierStatus, assignedCheckerLevel)
  }

  return true
}
