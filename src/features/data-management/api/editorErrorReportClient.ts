import { saveDossierMetadataWithIssueReport } from '@/features/data-management/api/dataEntryClient'
import {
  canEditorSubmitReport,
  mapEditorErrorReportTypeToApiLabel,
  mapIssueReportToEditorErrorReport,
} from '@/features/data-management/lib/editorErrorReportHelpers'
import type {
  EditorErrorReportSubmitForm,
  EditorErrorReportRejectForm,
} from '@/features/data-management/schemas'
import type {
  DataDossierMetadataT,
  EditorErrorReportT,
  IssueReportRejectResponseT,
  IssueReportT,
} from '@/features/data-management/types'
import { apiClient } from '@/lib/api/apiClient'

export async function fetchIssueReportsByDossier(
  dossierId: string,
): Promise<Array<IssueReportT>> {
  const response = await apiClient.get<Array<IssueReportT>>(
    `/api/v1/issue-reports/dossier/${encodeURIComponent(dossierId)}`,
  )
  return response.data
}

export async function confirmIssueReport(
  reportId: string,
): Promise<IssueReportT> {
  const response = await apiClient.post<IssueReportT>(
    `/api/v1/issue-reports/${encodeURIComponent(reportId)}/confirm`,
  )
  return response.data
}

export async function rejectIssueReport(
  reportId: string,
  payload: EditorErrorReportRejectForm,
): Promise<IssueReportRejectResponseT> {
  const response = await apiClient.post<IssueReportRejectResponseT>(
    `/api/v1/issue-reports/${encodeURIComponent(reportId)}/reject`,
    {
      notes: payload.rejectNote.trim(),
      reject_fields: payload.rejectFields ?? [],
    },
  )
  return response.data
}

export async function escalateIssueReport(
  reportId: string,
): Promise<IssueReportT> {
  const response = await apiClient.post<IssueReportT>(
    `/api/v1/issue-reports/${encodeURIComponent(reportId)}/escalate`,
  )
  return response.data
}

export async function submitEditorErrorReport(input: {
  dossierId: string
  dossierName: string
  metadata: DataDossierMetadataT
  payload: EditorErrorReportSubmitForm
  reporterId: string
  existingReports: Array<EditorErrorReportT>
}): Promise<void> {
  if (
    !canEditorSubmitReport(
      input.existingReports,
      input.dossierId,
      input.reporterId,
    )
  ) {
    throw new Error('A pending error report already exists for this dossier')
  }

  await saveDossierMetadataWithIssueReport(
    input.dossierId,
    input.metadata,
    {
      type: mapEditorErrorReportTypeToApiLabel(input.payload.errorType),
      notes: input.payload.description,
    },
  )
}

export async function fetchEditorErrorReportsByDossier(
  dossierId: string,
  dossierName: string,
): Promise<Array<EditorErrorReportT>> {
  const reports = await fetchIssueReportsByDossier(dossierId)
  return reports.map((report) =>
    mapIssueReportToEditorErrorReport(report, dossierName),
  )
}
