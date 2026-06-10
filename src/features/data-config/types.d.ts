import type { MetadataSchemaGroupT } from '@/features/group/types'
import type { DataTreeNodeT } from '@/features/data-management/types'

export interface DocumentTypeTemplateT {
  id: string
  name: string
  sourceDossierId?: string
  sourceDossierName?: string
  groups: Array<MetadataSchemaGroupT>
}

export interface AssignmentLevelT {
  id: string
  name: string
}

export interface DocumentAssignmentConfigT {
  templateId: string
  levels: Array<AssignmentLevelT>
  fieldKeysByLevelId: Record<string, Array<string>>
}

export interface DataConfigStateT {
  templates: Array<DocumentTypeTemplateT>
  assignmentsByTemplateId: Record<string, DocumentAssignmentConfigT>
  mockDossierTree: DataTreeNodeT
}
