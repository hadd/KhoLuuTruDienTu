export type DataNodeType = 'document' | 'record' | 'folder'

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

export interface DataDocumentFieldT {
  name: string
  display: string
  type: 'string' | 'date' | 'number'
  value: string
  page: number
  bbox: number[]
}

export interface DataTreeNodeT {
  id: string
  name: string
  type: DataNodeType
  parentId: string | null
  children: Array<DataTreeNodeT>
  sizeBytes: number
  uploadedAt: string
  uploadedBy: string
  mimeType?: string
  fileUrl?: string
  recordStatus?: DataRecordStatus
  editor?: DataAssigneeT
  reviewer1?: DataAssigneeT
  reviewer2?: DataAssigneeT
  reviewer3?: DataAssigneeT
  fields?: DataDocumentFieldT[]
}
