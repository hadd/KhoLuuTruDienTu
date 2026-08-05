export type ArchiveBorrowStatusT =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'DELIVERED'
  | 'RETURNED'

export type ArchiveBorrowDipStatusT = 'PENDING' | 'READY' | 'FAILED' | 'REVOKED'

export type ArchiveBorrowItemKindT = 'FILE' | 'DOSSIER' | 'PHYSICAL_DOSSIER'

export type ArchiveBorrowDipManifestEntryT = {
  fileId: string
  dossierId: string
  objectKey: string
  fileName: string
}

export type ArchiveBorrowItemT = {
  id: string
  requestId: string
  itemKind: ArchiveBorrowItemKindT
  dossierId: string
  fileId: string | null
  fileIdsSnapshot: Array<string> | null
  createdAt: string
}

export type ArchiveBorrowDipPackageT = {
  id: string
  status: ArchiveBorrowDipStatusT
  layout: 'ZIP' | 'UNPACKED'
  manifest: Array<ArchiveBorrowDipManifestEntryT>
  hasWatermark: boolean
  generatedAt: string | null
  revokedAt: string | null
  errorMessage: string | null
}

export type ArchiveBorrowRequestT = {
  id: string
  medium: 'ELECTRONIC' | 'PHYSICAL'
  requesterId: string
  reason: string
  status: ArchiveBorrowStatusT
  requestedFrom: string | null
  requestedUntil: string | null
  approvedFrom: string | null
  approvedUntil: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  activatedAt: string | null
  expiredAt: string | null
  createdAt: string
  updatedAt: string
  items: Array<ArchiveBorrowItemT>
  dipPackage: ArchiveBorrowDipPackageT | null
  requester?: {
    id: string
    fullName: string | null
    email: string | null
  } | null
  reviewer?: {
    id: string
    fullName: string | null
    email: string | null
  } | null
}

export type CreateArchiveBorrowItemInputT =
  | { itemKind: 'FILE'; dossierId: string; fileId: string }
  | { itemKind: 'DOSSIER'; dossierId: string }

export type CreateArchiveBorrowInputT = {
  reason: string
  requestedFrom: string
  requestedUntil: string
  items: Array<CreateArchiveBorrowItemInputT>
}

export type ApproveArchiveBorrowInputT = {
  approvedFrom: string
  approvedUntil: string
  reviewNotes?: string
  placementId?: string
}

export type ArchiveBorrowEligibleFileT = {
  id: string
  fileName: string
}

export type ArchiveBorrowEligibleDossierT = {
  id: string
  name: string
  folderPath: string
  status: string
  fondId: string | null
  fileCount: number
  files: Array<ArchiveBorrowEligibleFileT>
}

export type ArchiveBorrowViewerFileT = {
  fileId: string
  fileName: string
  filePath: string | null
  documentTypeId: string | null
  documentTypeName: string | null
  itemKind: 'FILE' | 'DOSSIER'
}

export type ArchiveBorrowViewerDossierT = {
  id: string
  name: string
  folderPath: string | null
  status: string | null
  archiveStorageState: string | null
  fondId: string | null
  fondName: string | null
  dossierTypeId: string | null
  dossierTypeName: string | null
  archiveYear: number | null
  itemKinds: Array<'FILE' | 'DOSSIER'>
  files: Array<ArchiveBorrowViewerFileT>
}

export type ArchiveBorrowViewModelT = {
  requestId: string
  status: ArchiveBorrowStatusT
  approvedFrom: string | null
  approvedUntil: string | null
  dipStatus: ArchiveBorrowDipStatusT
  dossiers: Array<ArchiveBorrowViewerDossierT>
}

export type ArchiveBorrowDossierMetadataT = {
  dossierId: string
  metadata: unknown | null
}

export type ArchiveBorrowAnnotationKindT = 'BOOKMARK' | 'NOTE'

export type ArchiveBorrowAnnotationBboxT = [number, number, number, number]

export type ArchiveBorrowReadingProgressT = {
  id: string
  requestId: string
  fileId: string
  page: number
  updatedAt: string
}

export type ArchiveBorrowAnnotationT = {
  id: string
  kind: ArchiveBorrowAnnotationKindT
  requestId: string
  fileId: string
  page: number
  bbox: ArchiveBorrowAnnotationBboxT | null
  selectedText: string | null
  body: string | null
  color: string | null
  createdAt: string
  updatedAt: string
}

export type CreateArchiveBorrowAnnotationInputT = {
  kind: ArchiveBorrowAnnotationKindT
  fileId: string
  page: number
  bbox?: ArchiveBorrowAnnotationBboxT | null
  selectedText?: string | null
  body?: string | null
  color?: string | null
}

export type UpdateArchiveBorrowAnnotationInputT = {
  page?: number
  bbox?: ArchiveBorrowAnnotationBboxT | null
  selectedText?: string | null
  body?: string | null
  color?: string | null
}

export type ArchiveBorrowCurrentlyReadingT = {
  requestId: string
  status: ArchiveBorrowStatusT
  approvedUntil: string | null
  reason: string
  fileId: string
  fileName: string
  page: number
  updatedAt: string
}

export type ArchiveBorrowSavedItemT = {
  requestId: string
  status: ArchiveBorrowStatusT
  approvedUntil: string | null
  reason: string
  bookmarkCount: number
  noteCount: number
  lastFileId: string | null
  lastFileName: string | null
  lastPage: number | null
  updatedAt: string
}

export type ArchiveBorrowReadingSummaryT = {
  currentlyReading: Array<ArchiveBorrowCurrentlyReadingT>
  saved: Array<ArchiveBorrowSavedItemT>
}
