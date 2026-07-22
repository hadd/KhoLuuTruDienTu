import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { getCheckerLevelForDossierStatus } from '@/features/data-management/lib/dossierStatusHelpers'
import type {
  DataDossierStatus,
  DataTreeNodeT,
  EditorErrorReportStatusT,
  EditorErrorReportT,
  EditorErrorReportTypeT,
  IssueReportApiStatusT,
  IssueReportT,
} from '@/features/data-management/types'

const PENDING_STATUSES: Array<EditorErrorReportStatusT> = [
  'pending_qc',
  'pending_manager',
]

const ERROR_TYPE_API_LABELS: Record<EditorErrorReportTypeT, string> = {
  cannot_open_file: 'Không mở được file',
  wrong_highlight: 'Highlight sai vị trí',
  other: 'Lỗi khác',
}

const API_LABEL_TO_ERROR_TYPE = Object.fromEntries(
  Object.entries(ERROR_TYPE_API_LABELS).map(([key, label]) => [label, key]),
) as Record<string, EditorErrorReportTypeT>

export function mapEditorErrorReportTypeToApiLabel(
  errorType: EditorErrorReportTypeT,
): string {
  return ERROR_TYPE_API_LABELS[errorType]
}

export function mapApiTypeLabelToErrorType(
  typeLabel: string,
): EditorErrorReportTypeT {
  return API_LABEL_TO_ERROR_TYPE[typeLabel.trim()] ?? 'other'
}

export function mapIssueReportApiStatus(
  status: IssueReportApiStatusT,
): EditorErrorReportStatusT {
  switch (status) {
    case 'PENDING':
      return 'pending_qc'
    case 'CONFIRMED':
      return 'qc_confirmed'
    case 'REJECTED':
      return 'qc_rejected'
    case 'ESCALATED':
      return 'pending_manager'
    default:
      return 'pending_qc'
  }
}

export function mapIssueReportToEditorErrorReport(
  report: IssueReportT,
  dossierName: string,
): EditorErrorReportT {
  const errorType = mapApiTypeLabelToErrorType(report.type)
  const resolveNotes = report.resolveNotes?.trim() ?? ''
  return {
    id: report.id,
    dossierId: report.dossierId,
    dossierName,
    errorType,
    apiTypeLabel: report.type,
    description: report.notes,
    reporterId: report.reporterId,
    reporterName: report.reporterName?.trim() || '',
    reporterAssignmentId: report.reporterAssignmentId,
    reportedAt: report.createdAt,
    status: mapIssueReportApiStatus(report.status),
    ...(report.status === 'REJECTED' && resolveNotes
      ? { rejectNote: resolveNotes }
      : {}),
    reviewedAt: report.resolvedAt ?? undefined,
    blocksChecker: report.blocksChecker,
  }
}

export function getRejectedIssueReportFromClaim(
  issueReport: IssueReportT | null | undefined,
  dossierName: string,
): EditorErrorReportT | null {
  if (!issueReport || issueReport.status !== 'REJECTED') return null
  return mapIssueReportToEditorErrorReport(issueReport, dossierName)
}

export function isPendingEditorErrorReportStatus(
  status: EditorErrorReportStatusT,
): boolean {
  return PENDING_STATUSES.includes(status)
}

export function canViewerActOnReport(
  role: DataManagementRole,
  report: EditorErrorReportT,
): boolean {
  if (report.status === 'pending_qc' && (role === 'qc' || role === 'admin')) {
    return true
  }
  if (
    report.status === 'pending_manager' &&
    (role === 'manager' || role === 'admin')
  ) {
    return true
  }
  return false
}

export function getPendingReportsForDossier(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  role: DataManagementRole,
): Array<EditorErrorReportT> {
  return reports.filter(
    (report) =>
      report.dossierId === dossierId && canViewerActOnReport(role, report),
  )
}

export function countPendingIssueReportsForRole(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  role: DataManagementRole,
): number {
  return getPendingReportsForDossier(reports, dossierId, role).length
}

/** Matches assignment tree: only API `PENDING` issue reports show the tree icon. */
export function countTreePendingIssueReports(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
): number {
  return reports.filter(
    (report) =>
      report.dossierId === dossierId && report.status === 'pending_qc',
  ).length
}

export function getReportsForDossierReview(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  role: DataManagementRole,
): Array<EditorErrorReportT> {
  const dossierReports = reports.filter(
    (report) => report.dossierId === dossierId,
  )
  const hasPending = dossierReports.some((report) =>
    canViewerActOnReport(role, report),
  )
  if (!hasPending) return []

  return [...dossierReports].sort((left, right) => {
    const leftPending = canViewerActOnReport(role, left) ? 0 : 1
    const rightPending = canViewerActOnReport(role, right) ? 0 : 1
    if (leftPending !== rightPending) return leftPending - rightPending
    return right.reportedAt.localeCompare(left.reportedAt)
  })
}

export function getIssueReportStatusLabelKey(
  status: EditorErrorReportStatusT,
):
  | 'editorErrorReport.review.status.confirmed'
  | 'editorErrorReport.review.status.rejected'
  | 'editorErrorReport.review.status.escalated'
  | null {
  switch (status) {
    case 'qc_confirmed':
    case 'manager_confirmed':
      return 'editorErrorReport.review.status.confirmed'
    case 'qc_rejected':
    case 'manager_rejected':
      return 'editorErrorReport.review.status.rejected'
    case 'pending_manager':
      return 'editorErrorReport.review.status.escalated'
    default:
      return null
  }
}

export function getPendingReportForDossier(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  role: DataManagementRole,
): EditorErrorReportT | null {
  return getPendingReportsForDossier(reports, dossierId, role)[0] ?? null
}

export function getDossierIdsWithPendingReports(
  reports: Array<EditorErrorReportT>,
  role: DataManagementRole,
): Set<string> {
  const ids = new Set<string>()
  for (const report of reports) {
    if (canViewerActOnReport(role, report)) {
      ids.add(report.dossierId)
    }
  }
  return ids
}

/**
 * QC/admin/manager được xem báo cáo lỗi trên hồ sơ đang phụ trách.
 * QC: chỉ cần có assignment (`assignedCheckerLevel`) — không phụ thuộc
 * `canQcSubmitAtAssignedLevel`, vì status hồ sơ có thể lệch tạm thời
 * (vd. ENTRY_PROCESSING) trong khi assignment vẫn mang `issueReports` PENDING.
 */
export function canShowEditorErrorReportsForDossier({
  role,
  dossierStatus,
  assignedCheckerLevel,
}: {
  role: DataManagementRole
  dossierStatus?: DataDossierStatus
  assignedCheckerLevel?: number
}): boolean {
  if (role === 'manager') {
    return true
  }

  if (role === 'qc') {
    return assignedCheckerLevel != null
  }

  if (!dossierStatus) return false

  if (role === 'admin') {
    return getCheckerLevelForDossierStatus(dossierStatus) != null
  }

  return false
}

export function collectDossierIdsWithPendingIssueReports(
  tree: DataTreeNodeT | null | undefined,
  options?: {
    role?: DataManagementRole
  },
): Set<string> {
  const ids = new Set<string>()
  if (!tree) return ids

  function walk(node: DataTreeNodeT) {
    if (
      node.type === 'record' &&
      node.dossierId &&
      (node.pendingIssueReportCount ?? 0) > 0
    ) {
      const canShow =
        !options?.role ||
        canShowEditorErrorReportsForDossier({
          role: options.role,
          dossierStatus: node.dossierStatus,
          assignedCheckerLevel: node.assignedCheckerLevel,
        })
      if (canShow) {
        ids.add(node.dossierId)
      }
    }
    for (const child of node.children) {
      walk(child)
    }
  }

  walk(tree)
  return ids
}

function isReportByEditor(
  report: EditorErrorReportT,
  reporterId: string,
): boolean {
  return report.reporterId === reporterId
}

export function canEditorSubmitReport(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  reporterId: string,
): boolean {
  return !reports.some(
    (report) =>
      report.dossierId === dossierId &&
      isReportByEditor(report, reporterId) &&
      isPendingEditorErrorReportStatus(report.status),
  )
}

export function getEditorPendingReport(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  reporterId: string,
): EditorErrorReportT | null {
  return (
    reports.find(
      (report) =>
        report.dossierId === dossierId &&
        isReportByEditor(report, reporterId) &&
        isPendingEditorErrorReportStatus(report.status),
    ) ?? null
  )
}

export function getLatestRejectedReportForEditor(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  reporterId: string,
): EditorErrorReportT | null {
  const rejected = reports
    .filter(
      (report) =>
        report.dossierId === dossierId &&
        isReportByEditor(report, reporterId) &&
        (report.status === 'qc_rejected' ||
          report.status === 'manager_rejected'),
    )
    .sort((left, right) =>
      (right.reviewedAt ?? right.reportedAt).localeCompare(
        left.reviewedAt ?? left.reportedAt,
      ),
    )

  return rejected[0] ?? null
}

export function getErrorTypeLabelKey(
  errorType: EditorErrorReportTypeT,
): `editorErrorReport.form.errorType.${EditorErrorReportTypeT}` {
  return `editorErrorReport.form.errorType.${errorType}`
}

export function getIssueReportTypeLabel(
  report: EditorErrorReportT,
  translate: (key: ReturnType<typeof getErrorTypeLabelKey>) => string,
): string {
  if (report.apiTypeLabel?.trim()) {
    return report.apiTypeLabel.trim()
  }
  return translate(getErrorTypeLabelKey(report.errorType))
}

export function canForwardReport(
  role: DataManagementRole,
  report: EditorErrorReportT,
): boolean {
  return report.status === 'pending_qc' && (role === 'qc' || role === 'admin')
}

export function isEditorDossierQcRejected(
  node: Pick<DataTreeNodeT, 'isReturned' | 'lastRejectNotes' | 'rejectFields'>,
): boolean {
  if (node.isReturned) return true
  if (node.lastRejectNotes?.trim()) return true
  return (node.rejectFields?.length ?? 0) > 0
}

export function countPendingIssueReports(
  issueReports: Array<IssueReportT> | undefined,
): number {
  return (issueReports ?? []).filter((report) => report.status === 'PENDING')
    .length
}
