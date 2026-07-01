import type {
  AdminIssueReportT,
  CloseAdminIssueReportPayloadT,
} from '@/features/project-manager/types'
import { apiClient } from '@/lib/api/apiClient'

/** GET /api/v1/admin/issue-reports/ */
export async function getAdminIssueReports(): Promise<
  Array<AdminIssueReportT>
> {
  const response = await apiClient.get<Array<AdminIssueReportT>>(
    '/api/v1/admin/issue-reports/',
  )
  return response.data
}

/** POST /api/v1/admin/issue-reports/:reportId/close */
export async function closeAdminIssueReport(
  reportId: string,
  payload: CloseAdminIssueReportPayloadT,
): Promise<AdminIssueReportT> {
  const response = await apiClient.post<AdminIssueReportT>(
    `/api/v1/admin/issue-reports/${encodeURIComponent(reportId)}/close`,
    payload,
  )
  return response.data
}
