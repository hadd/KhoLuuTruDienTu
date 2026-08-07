export type DisposalCouncilMemberPositionRoleT = string

export type DisposalCouncilMemberRepresentationTypeT =
  | 'LEADERSHIP'
  | 'ARCHIVE_DEPT'
  | 'SPECIALIST_DEPT'
  | 'OTHER'

export type DisposalCouncilMemberInputT = {
  userId: string
  positionRole: DisposalCouncilMemberPositionRoleT
  representationType: DisposalCouncilMemberRepresentationTypeT
  sortOrder?: number
}

export type DisposalCouncilMemberT = DisposalCouncilMemberInputT & {
  id: string
  fullName: string
  email: string
  sortOrder: number
}

export type DisposalCouncilSummaryT = {
  id: string
  code: string
  catalogId: string
  catalogName: string
  catalogCode: string
  catalogStatus: string
  copiedFromCouncilId: string | null
  reviewStartedAt: string | null
  reviewResult: 'APPROVED' | 'REJECTED' | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type DisposalCouncilDetailT = {
  council: DisposalCouncilSummaryT
  members: Array<DisposalCouncilMemberT>
  warnings?: Array<DisposalCouncilConflictWarningT>
}

export type DisposalCouncilConflictWarningT = {
  type: 'CONFLICT_OF_INTEREST'
  userId: string
  dossierId: string
  message: string
}

export type DisposalCouncilHistoryItemT = {
  id: string
  action: 'CREATE' | 'ADD' | 'REMOVE' | 'UPDATE'
  reason: string
  beforeSnapshot: unknown
  afterSnapshot: unknown
  createdAt: string
  changedBy: string
  changedByName: string
}

export type DisposalSettingsT = {
  councilReviewEnabled: boolean
  updatedBy: string | null
  updatedAt: string
}

export type AvailableCatalogForCouncilT = {
  id: string
  code: string
  name: string
  catalogDate: string
  status: string
}
