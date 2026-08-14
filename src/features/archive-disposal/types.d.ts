export type DisposalCandidateCategoryT =
  | 'all'
  | 'expiring_soon'
  | 'expired'
  | 'duplicate'

export type DisposalCandidateEntityKindT = 'dossier' | 'document' | 'grouped'

export type DisposalCandidateGroupT = {
  dossierId: string
  dossierName: string
  fondId: string | null
  fondName: string | null
  dossierTypeId: string | null
  dossierTypeName: string | null
  retentionPeriodId: string | null
  retentionPeriodName: string | null
  archivedAt: string | null
  expiresAt: string | null
  retentionStatus: string
  dossierItem: DisposalCandidateItemT | null
  documentItems: Array<DisposalCandidateItemT>
}

export type DisposalCandidateItemT = {
  entityKind: DisposalCandidateEntityKindT
  dossierId: string
  fileId: string | null
  dossierName: string
  fondId: string | null
  fondName: string | null
  dossierTypeId: string | null
  dossierTypeName: string | null
  fileName: string | null
  retentionPeriodId: string | null
  retentionPeriodName: string | null
  archivedAt: string | null
  expiresAt: string | null
  retentionStatus: string
  categories: Array<'expiring_soon' | 'expired' | 'duplicate'>
  duplicateGroupId: string | null
  duplicateCriteria: Array<string>
  duplicatePeerCount: number
  disposalCatalogStatus: string | null
  disposalCatalogId: string | null
}

export type DisposalCandidatesResponseT = {
  items: Array<DisposalCandidateItemT>
  groups?: Array<DisposalCandidateGroupT>
  page: number
  limit: number
  total: number
  totalPages: number
  fondScope: Array<string> | null
  message?: string
}

export type GetDisposalCandidatesParamsT = {
  category?: DisposalCandidateCategoryT
  entityKind?: DisposalCandidateEntityKindT
  fondId?: string
  dossierTypeId?: string
  documentTypeId?: string
  inventoryId?: string
  retentionPeriodId?: string
  physicalItemId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}

export type DisposalProposalCatalogStatusT =
  | 'DRAFT'
  | 'PENDING_SUBMIT'
  | 'SUBMITTED'
  | 'AWAITING_FEEDBACK'
  | 'APPROVED'
  | 'REJECTED'
  | 'DESTROYED'

export type DisposalProposalItemSourceT =
  | 'EXPIRED'
  | 'EXPIRING_SOON'
  | 'DUPLICATE'
  | 'WAREHOUSE'

export type DisposalProposalCatalogT = {
  id: string
  code: string
  name: string
  catalogDate: string
  notes: string
  status: DisposalProposalCatalogStatusT
  createdBy: string
  creatorName?: string | null
  createdAt: string
  updatedAt: string
}

export type DisposalProposalItemT = {
  id: string
  dossierId: string
  fileId: string | null
  source: DisposalProposalItemSourceT
  reason: string
  notes: string
  dossierName?: string
  fileName?: string | null
  documentTypeName?: string | null
}

export type TransferToProposalItemT = {
  dossierId: string
  fileId?: string | null
  source: DisposalProposalItemSourceT
}

export type TransferToProposalResultT = {
  catalogId: string
  items: Array<DisposalProposalItemT>
  skippedDuplicateCount?: number
}

export type DisposalCatalogReferenceFileT = {
  fileId: string
  fileName: string
  documentTypeName?: string | null
}

export type DisposalCatalogDetailT = {
  catalog: DisposalProposalCatalogT
  catalogFondId?: string | null
  catalogFondName?: string | null
  items: Array<DisposalProposalItemT>
  referenceFilesByDossierId?: Record<string, Array<DisposalCatalogReferenceFileT>>
}

export type Pl3ContentT = {
  creatingAgency: string
  formationMission: string
  collectionSource: string
  timePeriod: string
  expiryDuplicateReason: string
  priorValuation: string
  countsDetail: string
  timeRangeText: string
  expiredGroupSummary: string
  duplicateGroupSummary: string
  otherGroupSummary: string
}

export type Pl3SuggestionsResponseT = {
  fondName: string
  content: Pl3ContentT
}

export type AppraisalDocumentTypeT =
  | 'PL2'
  | 'PL3'
  | 'MINUTES_COUNCIL'
  | 'MINUTES_DESTRUCTION'

export type AppraisalDocumentStatusT = {
  documentType: AppraisalDocumentTypeT
  draftExportedAt: string | null
  signedUploadedAt: string | null
  hasDraft: boolean
  hasSigned: boolean
}

export type AppraisalDocumentsResponseT = {
  catalogId: string
  catalogCode: string
  appraisalSubmittedAt: string | null
  evaluationsLocked: boolean
  bothMinutesExportedAt: string | null
  readyToSubmit: boolean
  missingComponents: string[]
  documents: Array<AppraisalDocumentStatusT>
  exportHistory: Array<{
    id: string
    documentType: AppraisalDocumentTypeT
    runNumber: number
    createdAt: string
    createdBy: string
  }>
}

export type EditableDocumentSlugT = 'pl3' | 'minutes-council' | 'minutes-destruction'

export type DocumentDraftResponseT = {
  documentType: AppraisalDocumentTypeT
  contentJson: Record<string, unknown>
  sourceHash: string | null
  currentSourceHash: string
  sourceStale: boolean
  hasUploadedDocx: boolean
  updatedAt: string | null
}
