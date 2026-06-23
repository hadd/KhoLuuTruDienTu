// @/features/editor-dossiers/types.d.ts

import type { DataDossierMetadataT } from '@/features/data-management/types'

export interface EditorDraftAssignmentDossierFileT {
  id: string
  fileName: string
  filePath: string
  fileSizeKb: number
  fullPath: string
  searchablePdfPath?: string
  searchablePdfFullPath?: string
}

export interface EditorDraftAssignmentDossierT {
  id: string
  name: string
  folderPath: string
  status: string
  entityType: string
  currentMetadataKey?: string
  ocrMetadataKey?: string
  updatedAt: string
  deletedAt?: string | null
  files?: Array<EditorDraftAssignmentDossierFileT>
}

export interface EditorDraftAssignmentT {
  id: string
  role: string
  status: string
  workQuality: string | null
  attemptNumber: number
  stepNumber: number
  assignedAt: string
  completedAt: string | null
  currentMetadataUrl?: string | null
  dossier: EditorDraftAssignmentDossierT
}

export interface EditorDraftAssignmentsResponseT {
  assignments: Array<EditorDraftAssignmentT>
  totalAssignments: number
}

/** Normalized row for editor draft dossier list */
export interface EditorDraftDossierT {
  assignmentId: string
  dossierId: string
  name: string
  assignedAt: string
  updatedAt: string
  currentMetadataUrl?: string | null
}

export interface EditorDraftFilesAssignmentT {
  id: string
  status: string
  role: string
}

export interface EditorDraftFilesResponseT {
  nodeType: 'file'
  dossierId: string
  currentMetadataUrl?: string | null
  assignment?: EditorDraftFilesAssignmentT
  children: Array<{
    id: string
    dossierId: string
    fileName: string
    filePath: string
    fileSizeKb: number
    createdAt: string
    fileUrl: string
    searchablePdfPath?: string
    searchablePdfUrl?: string
  }>
}

export interface EditorDraftSubmitItemT {
  dossierId: string
  /** Omitted when submitting unchanged drafts from list — BE loads from currentMetadataUrl. */
  metadata?: DataDossierMetadataT
}

export interface EditorDraftSubmitPayloadT {
  items: Array<EditorDraftSubmitItemT>
}

export interface EditorDraftSubmitResultItemT {
  dossierId: string
  assignmentId: string
  role: string
  dossierStatus: string
  metadataKey: string
  currentMetadataUrl?: string | null
  partial: boolean
}

export interface EditorDraftSubmitFailedItemT {
  dossierId: string
  reason?: string
  message?: string
}

export interface EditorDraftSubmitResultT {
  submitted: Array<EditorDraftSubmitResultItemT>
  failed: Array<EditorDraftSubmitFailedItemT>
  submittedCount: number
  failedCount: number
}
