export type ArchiveFieldTypeT =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'REFERENCE'

export type ArchiveReferenceSourceT =
  | 'FOND'
  | 'INVENTORY'
  | 'RETENTION_PERIOD'
  | 'DOSSIER_TYPE'
  | 'PHYSICAL_BOTTOM_ITEM'

export type ArchiveFieldSelectOptionT = {
  value: string
  label: string
}

export type ArchiveFieldConfigT = {
  id: string
  fieldKey: string
  label: string
  fieldType: ArchiveFieldTypeT
  referenceSource: ArchiveReferenceSourceT | null
  dependsOnFieldKey: string | null
  isRequired: boolean
  options: Array<ArchiveFieldSelectOptionT>
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateArchiveFieldConfigPayloadT = {
  fieldKey: string
  label: string
  fieldType: ArchiveFieldTypeT
  referenceSource?: ArchiveReferenceSourceT | null
  dependsOnFieldKey?: string | null
  isRequired?: boolean
  options?: Array<ArchiveFieldSelectOptionT>
  displayOrder?: number
  isActive?: boolean
}

export type UpdateArchiveFieldConfigPayloadT = Partial<CreateArchiveFieldConfigPayloadT>
