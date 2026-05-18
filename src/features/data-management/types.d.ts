export type DataNodeType = 'document' | 'record' | 'empty_folder'

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
}
