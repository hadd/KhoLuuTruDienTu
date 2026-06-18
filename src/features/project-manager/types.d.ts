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
