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
  | 'ENTRY_DRAFT'
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

export type DataCheckerRoleT =
  | 'CHECKER_1'
  | 'CHECKER_2'
  | 'CHECKER_3'
  | 'CHECKER_4'
  | 'CHECKER_5'

export interface DataAssigneeT {
  id: string
  name: string
  role: 'editor' | 'reviewer'
}

export interface DataCheckerAssignmentT {
  level: number
  role: DataCheckerRoleT
  assignees: Array<DataAssigneeT>
}

export interface DataRecordInfoFieldT {
  name: string
  value: string
}

export interface DataDocumentFieldT {
  name: string
  display: string
  type: 'string' | 'date' | 'number' | 'boolean'
  value: string
  page: number
  bboxes: Array<[number, number, number, number]>
  /** OCR raster page width in pixels — backend should provide for accurate bbox mapping */
  page_width?: number
  /** OCR raster page height in pixels — backend should provide for accurate bbox mapping */
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
  /** OCR/searchable PDF URL — text layer supports copy. */
  ocrPdfUrl?: string
  recordStatus?: DataRecordStatus
  editor?: DataAssigneeT
  /** Checker assignments by approval level (Duyệt 1–5). */
  checkerAssignments?: Array<DataCheckerAssignmentT>
  /** @deprecated Use checkerAssignments — kept for backward compatibility. */
  reviewer1?: DataAssigneeT
  /** @deprecated Use checkerAssignments — kept for backward compatibility. */
  reviewer2?: DataAssigneeT
  /** @deprecated Use checkerAssignments — kept for backward compatibility. */
  reviewer3?: DataAssigneeT
  fields?: Array<DataDocumentFieldT>
  dossierMetadata?: DataDossierMetadataT
  /** Unfiltered metadata snapshot used when persisting editor changes. */
  fullDossierMetadata?: DataDossierMetadataT
  /** Number of QC reviewers required for this dossier. */
  requiredQcCount?: number
  /** Raw backend dossier status from the API */
  dossierStatus?: DataDossierStatus
  /** Backend assignment flag from /all-first-subfolders */
  isAssigned?: boolean
  /** Hide assignment icon — used for listing folders from /all-parent */
  suppressAssignedIndicator?: boolean
  /** Project scope from folders API (`projectCode` / `project_code`). */
  projectCode?: string
  /** Storage path from folders API (e.g. `raw/abc`). */
  folderPath?: string
  /** QC-rejected field keys (`GROUP_CODE.FIELD_NAME`) from maker/claim. */
  rejectFields?: Array<string>
  /** QC rejection notes shown to editor on rework. */
  lastRejectNotes?: string
  /** Cấp duyệt (1–5) mà user QC hiện tại được gán trên hồ sơ này. */
  assignedCheckerLevel?: number
  /** Field keys editor được phép sửa (luồng group slot). Rỗng/absent = full metadata. */
  allowedFields?: Array<string>
  /** Editor PDF mask — true khi metadata giới hạn theo slot (group + permission-assignments). */
  shouldPdfMask?: boolean
  /** Maker assignment status from claim (e.g. DRAFT). */
  assignmentStatus?: string
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
  status?: string
  workQuality?: string | null
}

export interface MakerClaimDossierT {
  id: string
  name: string
  status: string
  ocrMetadataKey?: string
  rejectCount?: number
  lastRejectNotes?: string | null
  isReturned?: boolean
  rejectedQcStep?: number
}

/** GET /api/v1/folders/dossiers/:dossierId/files — file item in children */
export interface DossierFileT {
  id: string
  dossierId: string
  fileName: string
  filePath: string
  fileSizeKb: number
  createdAt: string
  fileUrl: string
  searchablePdfPath?: string
  searchablePdfUrl?: string
}

/** GET /api/v1/folders/dossiers/:dossierId/files response body */
export interface DossierFilesResponseT {
  nodeType: 'file'
  dossierId: string
  currentMetadataUrl?: string | null
  children: Array<DossierFileT>
}

export interface MakerClaimFileT {
  id: string
  fileName: string
  fileUrl: string
  searchablePdfUrl?: string
}

export interface MakerClaimT {
  assignment: MakerAssignmentT
  dossier: MakerClaimDossierT
  files: Array<MakerClaimFileT>
  currentMetadataUrl?: string | null
  currentMetadata?: DataDossierMetadataT | null
  allowedFields?: Array<string> | null
  rejectFields?: Array<string> | null
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

/** POST /api/v1/data-entry/checker/reject/:dossierId request body */
export interface CheckerRejectPayloadT {
  notes: string
  reject_fields: Array<string>
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

export type ProjectStatusT =
  | 'IN_PROGRESS'
  | 'EXTENDED'
  | 'COMPLETED'
  | 'CANCELLED'
  | string

/** GET /api/v1/admin/projects/ item */
export interface ProjectT {
  projectCode: string
  projectName: string
  projectType: string
  investor: string
  startDate: string | null
  acceptanceDate: string | null
  totalInvestment: string | null
  status: ProjectStatusT
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** GET /api/v1/admin/projects/ response */
export interface ProjectsListResponseT {
  items: Array<ProjectT>
  limit: number
  offset: number
}

export type EditorErrorReportTypeT =
  | 'cannot_open_file'
  | 'wrong_highlight'
  | 'other'

/** Payload for PUT dossier metadata with editor issue report */
export interface DossierIssueReportT {
  type: string
  notes: string
}

export type EditorErrorReportStatusT =
  | 'pending_qc'
  | 'qc_confirmed'
  | 'qc_rejected'
  | 'pending_manager'
  | 'manager_confirmed'
  | 'manager_rejected'

export interface EditorErrorReportT {
  id: string
  dossierId: string
  dossierName: string
  errorType: EditorErrorReportTypeT
  description: string
  reporterId: string
  reporterName: string
  reportedAt: string
  status: EditorErrorReportStatusT
  rejectNote?: string
  reviewedAt?: string
  reviewedByName?: string
}
