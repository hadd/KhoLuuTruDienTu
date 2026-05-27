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
  value: string
  page: number
  bbox: Array<number>
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
  currentMetadataUrl: string
}
