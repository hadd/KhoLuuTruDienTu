// @/features/data-management/types.d.ts

export type DataNodeType = 'document' | 'record' | 'folder'

/** Backend folder entity type from folders API */
export type DataFolderEntityType = 'DOCUMENT' | 'FOLDER'

export type DataRecordStatus =
  | 'pendingOcr'
  | 'edited'
  | 'pendingApproval'
  | 'approved1'
  | 'approved2'
  | 'final'
  | 'completed'

/** Backend dossier status values from /api/v1/folders/:id/all-first-subfolders */
export type DataDossierStatus =
  | 'NEW'
  | 'OCR_PROCESSING'
  | 'OCR_FAILED'
  | 'READY_FOR_ENTRY'
  | 'ENTRY_PROCESSING'
  | 'WAITING_CHECKER_1'
  | 'CHECKER_1_PROCESSING'
  | 'CHECKER_1_REJECTED'
  | 'WAITING_CHECKER_2'
  | 'CHECKER_2_PROCESSING'
  | 'CHECKER_2_REJECTED'
  | 'WAITING_CHECKER_3'
  | 'CHECKER_3_PROCESSING'
  | 'CHECKER_3_REJECTED'
  | 'WAITING_CHECKER_4'
  | 'CHECKER_4_PROCESSING'
  | 'CHECKER_4_REJECTED'
  | 'WAITING_CHECKER_5'
  | 'CHECKER_5_PROCESSING'
  | 'CHECKER_5_REJECTED'
  | 'APPROVED'

export interface DataAssigneeT {
  id: string
  name: string
  role: 'editor' | 'reviewer'
}

export interface DataRecordInfoFieldT {
  name: string
  value: string
}

export interface DataDocumentFieldT {
  name: string
  display: string
  type: 'string' | 'date' | 'number' | 'boolean'
  value: string | null
  page: number
  bboxes: Array<[number, number, number, number]>
  /** Raster width of source page when bbox coords are in pixel space */
  page_width?: number
  /** Raster height of source page when bbox coords are in pixel space */
  page_height?: number
}

export interface DataMetadataGroupT {
  group_code: string
  group_name: string
  source_document?: {
    file_name?: string
    file_path?: string
  }
  fields: Array<DataDocumentFieldT>
}

export interface DataDossierMetadataT {
  ho_so_id?: string
  trang_thai_ho_so?: string
  general_fields?: Array<DataRecordInfoFieldT>
  metadata_groups: Array<DataMetadataGroupT>
}

export interface DataMetadataEditFieldChangeT {
  id: string
  groupIndex: number
  fieldIndex: number
  fieldName: string
  fieldDisplay: string
  oldValue: string
  newValue: string
  field: DataDocumentFieldT
}

export interface DataMetadataEditBatchT {
  id: string
  editorName: string
  editedAt: string
  changes: Array<DataMetadataEditFieldChangeT>
  action?: string | null
  notes?: string | null
  versionNumber?: number
}

/** GET /api/v1/dossiers/:id/metadata-history — single history entry */
export interface DataMetadataHistoryFieldChangeT {
  old: string | null
  new: string | null
}

export interface DataMetadataHistoryEntryT {
  id: string
  versionNumber: number
  action: string
  role: string | null
  fromStatus: string | null
  toStatus: string | null
  fieldChanges: Record<string, DataMetadataHistoryFieldChangeT> | null
  notes: string | null
  createdAt: string
  s3Key?: string
  metadata?: DataDossierMetadataT
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
}

/** POST /api/v1/dossiers/:id/metadata-history/:historyId/restore */
export interface DataMetadataHistoryRestoreResultT {
  dossierId: string
  restoredFromHistoryId: string
  newVersionNumber: number
  s3Key: string
}

export interface DataTreeNodeT {
  id: string
  /** Dossier entity id for PUT /api/v1/dossiers/:id */
  dossierId?: string
  /** Folder id for assign-by-folder API. */
  folderId?: string
  /** Backend entity type — assign editor when `DOCUMENT`. */
  entityType?: DataFolderEntityType
  name: string
  type: DataNodeType
  parentId: string | null
  children: Array<DataTreeNodeT>
  sizeBytes: number
  uploadedAt: string
  uploadedBy: string
  mimeType?: string
  /** Logical path for metadata matching (distinct from signed fileUrl). */
  filePath?: string
  fileUrl?: string // Đã sửa lỗi type gốc (ileUrl -> fileUrl)
  recordStatus?: DataRecordStatus
  editor?: DataAssigneeT
  reviewer1?: DataAssigneeT
  reviewer2?: DataAssigneeT
  reviewer3?: DataAssigneeT
  fields?: Array<DataDocumentFieldT>
  dossierMetadata?: DataDossierMetadataT
  /** Number of QC reviewers required for this dossier. */
  requiredQcCount?: number
  /** Raw backend dossier status from the API */
  dossierStatus?: DataDossierStatus
}

export interface UploadFolderResult {
  success: boolean
  message?: string
}

export interface MakerAssignmentT {
  id: string
  dossierId: string
  role: string
  attemptNumber: number
}

export interface MakerClaimDossierT {
  id: string
  name: string
  status: string
  ocrMetadataKey?: string
}

export interface MakerClaimFileT {
  id: string
  fileName: string
  fileUrl: string
}

export interface MakerClaimT {
  assignment: MakerAssignmentT
  dossier: MakerClaimDossierT
  files: Array<MakerClaimFileT>
  /** Presigned URL to fetch metadata JSON — mutually exclusive with inline metadata. */
  currentMetadataUrl: string | null
  /** Inline metadata payload — used when `currentMetadataUrl` is null. */
  currentMetadata?: DataDossierMetadataT | null
  /** Field keys the maker may edit (e.g. `GROUP_CODE.FIELD_NAME`) — only present with inline metadata. */
  allowedFields?: Array<string> | null
}

/** Socket event `ocr:completed` payload */
export interface OcrCompletedEventT {
  dossierId: string
  folderId: string
  folderPath?: string
  status: DataDossierStatus | string
  fromStatus?: DataDossierStatus | string
  ocrMetadataKey?: string
  at?: string
}

/** POST /api/v1/data-entry/checker/reject/:dossierId response */
export interface CheckerRejectResponseT {
  dossierId: string
  assignmentId: string
  dossierStatus: DataDossierStatus
  rejectCount: number
  rejectedQcStep: number
  reopenedRoles: Array<string>
}
