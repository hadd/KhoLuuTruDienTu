import { authStore } from '@/features/auth/store'
import { editorErrorReportStore } from '@/features/data-management/store/editorErrorReportStore'
import {
  canEditorSubmitReport,
  isPendingEditorErrorReportStatus,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  EditorErrorReportSubmitForm,
  EditorErrorReportRejectForm,
} from '@/features/data-management/schemas'
import type {
  EditorErrorReportStatusT,
  EditorErrorReportT,
} from '@/features/data-management/types'

function getReviewerName(): string {
  const user = authStore.getState().user
  return user?.fullName?.trim() || user?.email?.trim() || 'Reviewer'
}

function getReporterInfo() {
  const user = authStore.getState().user
  return {
    reporterId: user?.id ?? 'anonymous',
    reporterName: user?.fullName?.trim() || user?.email?.trim() || 'Editor',
  }
}

function updateReportStatus(
  reportId: string,
  status: EditorErrorReportStatusT,
  extra?: Pick<EditorErrorReportT, 'rejectNote' | 'reviewedAt' | 'reviewedByName'>,
): EditorErrorReportT {
  const report = editorErrorReportStore
    .getState()
    .reports.find((item) => item.id === reportId)

  if (!report) {
    throw new Error('Editor error report not found')
  }

  const nextReport: EditorErrorReportT = {
    ...report,
    status,
    reviewedAt: extra?.reviewedAt ?? new Date().toISOString(),
    reviewedByName: extra?.reviewedByName ?? getReviewerName(),
    rejectNote: extra?.rejectNote,
  }

  editorErrorReportStore.upsertReport(nextReport)
  return nextReport
}

export async function submitEditorErrorReport(input: {
  dossierId: string
  dossierName: string
  payload: EditorErrorReportSubmitForm
}): Promise<EditorErrorReportT> {
  const reports = editorErrorReportStore.getState().reports
  if (!canEditorSubmitReport(reports, input.dossierId)) {
    throw new Error('A pending error report already exists for this dossier')
  }

  const reporter = getReporterInfo()
  const report: EditorErrorReportT = {
    id: crypto.randomUUID(),
    dossierId: input.dossierId,
    dossierName: input.dossierName,
    errorType: input.payload.errorType,
    description: input.payload.description,
    reporterId: reporter.reporterId,
    reporterName: reporter.reporterName,
    reportedAt: new Date().toISOString(),
    status: 'pending_qc',
  }

  editorErrorReportStore.upsertReport(report)
  return report
}

export async function confirmEditorErrorReport(
  reportId: string,
  nextStatus: Extract<
    EditorErrorReportStatusT,
    'qc_confirmed' | 'manager_confirmed'
  >,
): Promise<EditorErrorReportT> {
  return updateReportStatus(reportId, nextStatus, {
    rejectNote: undefined,
  })
}

export async function rejectEditorErrorReport(
  reportId: string,
  nextStatus: Extract<
    EditorErrorReportStatusT,
    'qc_rejected' | 'manager_rejected'
  >,
  payload: EditorErrorReportRejectForm,
): Promise<EditorErrorReportT> {
  return updateReportStatus(reportId, nextStatus, {
    rejectNote: payload.rejectNote,
  })
}

export async function forwardEditorErrorReportToManager(
  reportId: string,
): Promise<EditorErrorReportT> {
  const report = editorErrorReportStore
    .getState()
    .reports.find((item) => item.id === reportId)

  if (!report || report.status !== 'pending_qc') {
    throw new Error('Only pending QC reports can be forwarded')
  }

  return updateReportStatus(reportId, 'pending_manager', {
    rejectNote: undefined,
  })
}

export function listEditorErrorReportsByDossier(
  dossierId: string,
): Array<EditorErrorReportT> {
  return editorErrorReportStore
    .getState()
    .reports.filter((report) => report.dossierId === dossierId)
}

export function listPendingEditorErrorReportsForRole(
  role: 'qc' | 'manager' | 'admin',
): Array<EditorErrorReportT> {
  return editorErrorReportStore.getState().reports.filter((report) => {
    if (!isPendingEditorErrorReportStatus(report.status)) {
      return false
    }
    if (role === 'admin') {
      return true
    }
    if (role === 'qc') {
      return report.status === 'pending_qc'
    }
    return report.status === 'pending_manager'
  })
}
