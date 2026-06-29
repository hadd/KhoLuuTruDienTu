export type ProjectStatusT =
  | 'IN_PROGRESS'
  | 'EXTENDED'
  | 'ACCEPTED'
  | 'SUSPENDED'
  | 'CANCELLED'

export interface ProjectT {
  projectCode: string
  projectName: string
  projectType: string
  investor: string
  startDate: string | null
  acceptanceDate: string | null
  totalInvestment: string | null
  status: ProjectStatusT | string
  managerId?: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProjectsListResponseT {
  items: Array<ProjectT>
  limit: number
  offset: number
}

export interface CreateProjectPayloadT {
  projectCode: string
  projectName: string
  projectType: string
  investor: string
  startDate?: string
  acceptanceDate: string
  totalInvestment?: string
  status: ProjectStatusT | string
  managerId?: string
}

export type UpdateProjectPayloadT = CreateProjectPayloadT

export interface GetProjectsParamsT {
  limit?: number
  offset?: number
}

export interface ProjectProgressHistoryT {
  id: string
  projectCode: string
  extensionNumber: number
  previousAcceptanceDate: string
  newAcceptanceDate: string
  changeReason: string
  updatedBy: string
  recordedAt: string
}

/** GET /api/v1/admin/issue-reports/ item */
export type AdminIssueReportStatusT =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'CLOSED'

export interface AdminIssueReportT {
  id: string
  dossierId: string
  reporterId: string
  reporterName: string | null
  reporterAssignmentId: string
  status: AdminIssueReportStatusT
  type: string
  notes: string
  resolveNotes: string | null
  escalatedToId: string | null
  createdAt: string
  resolvedAt: string | null
  blocksChecker: boolean
  dossierName?: string
  dossierStatus?: string
  projectCode?: string
  dossierApproved?: boolean
}

export interface CloseAdminIssueReportPayloadT {
  notes: string
}
