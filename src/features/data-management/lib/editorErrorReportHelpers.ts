import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type {
  EditorErrorReportStatusT,
  EditorErrorReportT,
  EditorErrorReportTypeT,
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

export function mapEditorErrorReportTypeToApiLabel(
  errorType: EditorErrorReportTypeT,
): string {
  return ERROR_TYPE_API_LABELS[errorType]
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

export function getPendingReportForDossier(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
  role: DataManagementRole,
): EditorErrorReportT | null {
  return (
    reports.find(
      (report) =>
        report.dossierId === dossierId &&
        canViewerActOnReport(role, report),
    ) ?? null
  )
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

export function canEditorSubmitReport(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
): boolean {
  return !reports.some(
    (report) =>
      report.dossierId === dossierId &&
      isPendingEditorErrorReportStatus(report.status),
  )
}

export function getEditorPendingReport(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
): EditorErrorReportT | null {
  return (
    reports.find(
      (report) =>
        report.dossierId === dossierId &&
        isPendingEditorErrorReportStatus(report.status),
    ) ?? null
  )
}

export function getLatestRejectedReportForEditor(
  reports: Array<EditorErrorReportT>,
  dossierId: string,
): EditorErrorReportT | null {
  const rejected = reports
    .filter(
      (report) =>
        report.dossierId === dossierId &&
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

export function canForwardReport(
  role: DataManagementRole,
  report: EditorErrorReportT,
): boolean {
  return report.status === 'pending_qc' && (role === 'qc' || role === 'admin')
}
