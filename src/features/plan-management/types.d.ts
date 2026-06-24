export interface ProjectPlanProjectT {
  projectCode: string
  projectName: string
}

export interface ProjectPlanT {
  id: string
  name: string
  projectCode: string
  a4Pages: number
  a3Pages: number
  dossierCount: number
  quota: string
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  project: ProjectPlanProjectT
}

export interface ProjectPlansListResponseT {
  items: Array<ProjectPlanT>
  limit: number
  offset: number
}

export interface GetProjectPlansParamsT {
  projectCode: string
  limit?: number
  offset?: number
}

export type PlanPeriodT = 'all' | '7d' | '30d' | '90d' | '12m'

export interface CreateProjectPlanPayloadT {
  name: string
  projectCode: string
  a4Pages: number
  a3Pages: number
  dossierCount: number
  quota: string
  startDate: string
  endDate: string
}

export type UpdateProjectPlanPayloadT = CreateProjectPlanPayloadT
