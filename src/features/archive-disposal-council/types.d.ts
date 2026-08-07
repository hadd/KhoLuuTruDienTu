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

export type DisposalCouncilEvaluationDecisionT = 'DESTROY' | 'KEEP'

export type DisposalCouncilMemberT = DisposalCouncilMemberInputT & {
  id: string
  fullName: string
  email: string
  sortOrder: number
  excusedAbsent: boolean
  absentReason: string
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
  decisionPublishedAt: string | null
  decisionDocumentStorageKey: string | null
  signedMinutesStorageKey: string | null
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

export type DisposalCouncilEvaluationProgressT = {
  memberCount: number
  participatingMemberCount: number
  itemCount: number
  requiredCount: number
  submittedCount: number
  membersComplete: Array<string>
  missingMembers: Array<{
    userId: string
    fullName: string
    missingUnitCount: number
  }>
  evaluationsLocked: boolean
  isComplete: boolean
}

export type DisposalCouncilItemEvaluationT = {
  id: string
  councilId: string
  itemId: string
  userId: string
  userName: string
  note: string
  decision: DisposalCouncilEvaluationDecisionT | null
  createdAt: string
  updatedAt: string
}

export type DisposalCouncilItemOutcomeT = {
  itemId: string
  destroyVoteCount: number
  keepVoteCount: number
  participatingMemberCount: number
  concludedDecision: DisposalCouncilEvaluationDecisionT | null
  hasDissent: boolean
  needsChairDecision: boolean
  chairDecision: DisposalCouncilEvaluationDecisionT | null
  chairReason: string | null
  chairDecidedAt: string | null
}

export type DisposalCouncilEvaluationsResponseT = {
  progress: DisposalCouncilEvaluationProgressT
  items: Array<DisposalCouncilItemEvaluationT>
  outcomes: Array<DisposalCouncilItemOutcomeT>
}

export type DisposalCouncilDecisionDocumentsT = {
  decisionPublishedAt: string | null
  decisionDocumentUrl: string | null
  signedMinutesDocumentUrl: string | null
  hasSignedMinutes: boolean
}
