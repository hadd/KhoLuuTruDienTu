export type ScanBranchNodeType = 'project' | 'fond' | 'dossier' | 'document'

export type ScanNodeType = ScanBranchNodeType | 'page'

export interface ScanTreeNodeBaseT {
  id: string
  type: ScanBranchNodeType
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export type ScanProjectT = ScanTreeNodeBaseT & { type: 'project' }
export type ScanFondT = ScanTreeNodeBaseT & { type: 'fond' }
export type ScanDossierT = ScanTreeNodeBaseT & { type: 'dossier' }
export type ScanDocumentT = ScanTreeNodeBaseT & { type: 'document' }

export type ScanTreeNodeT =
  | ScanProjectT
  | ScanFondT
  | ScanDossierT
  | ScanDocumentT

export type ScanPageRotationT = 0 | 90 | 180 | 270

export interface ScanPageT {
  id: string
  documentId: string
  name: string
  sortOrder: number
  rotation: ScanPageRotationT
  scale: number
  imageData: string
  mimeType: 'image/png' | 'image/jpeg'
}

export interface ScanTreeBranchT extends ScanTreeNodeT {
  children: Array<ScanTreeBranchT>
}

export interface ScanWorkspaceT {
  nodes: Record<string, ScanTreeNodeT>
  pages: Record<string, ScanPageT>
  rootIds: Array<string>
}

export interface ScanUploadBatchPayloadT {
  nodeIds: Array<string>
  documentCount: number
  pageCount: number
}

export interface ScanUploadBatchResultT {
  uploadedNodeIds: Array<string>
}
