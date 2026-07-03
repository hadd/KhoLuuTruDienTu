export interface ProjectPlanProjectT {
  projectCode: string
  projectName: string
}

export interface ProjectPlanPaperPlanT {
  paperSizeId: string
  quantity: number
}

export interface ProjectPlanT {
  id: string
  name: string
  projectCode: string
  dossierCount: number
  dateCount: number
  pageTotal: number
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  paperPlans: Array<ProjectPlanPaperPlanT>
  project: ProjectPlanProjectT
}

export interface ProjectPlansListResponseT {
  items: Array<ProjectPlanT>
  limit: number
  offset: number
}

export interface GetProjectPlansParamsT {
  projectCode?: string
  viewAll?: boolean
  limit?: number
  offset?: number
}

export interface PaperSizeT {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface PaperSizesListResponseT {
  items: Array<PaperSizeT>
  limit: number
  offset: number
}

export interface CreatePaperSizePayloadT {
  name: string
}

export interface ProjectPlanPaperPlanPayloadT {
  paperSizeId: string
  quantity: number | string
}

export interface CreateProjectPlanPayloadT {
  name: string
  projectCode: string
  dossierCount: number | string
  startDate: string
  endDate: string
  dateCount: number | string
  paperPlans: Array<ProjectPlanPaperPlanPayloadT>
}

export type UpdateProjectPlanPayloadT = CreateProjectPlanPayloadT

export interface ProjectPlanDetailItemT {
  id: string
  planId: string
  taskName: string
  quantity: number
  unit: string
  quota: number
  dateCount: number
  workerCount: number
  createdAt: string
  updatedAt: string
}

export interface UpdateProjectPlanDetailItemPayloadT {
  taskName: string
  quantity: number | string
  unit: string
  quota: number | string
  dateCount: number | string
  workerCount: number | string
}

export interface UpdateProjectPlanDetailsPayloadT {
  details: Array<UpdateProjectPlanDetailItemPayloadT>
}
