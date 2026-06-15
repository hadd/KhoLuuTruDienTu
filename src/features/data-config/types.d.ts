import type { MetadataSchemaGroupT } from '@/features/group/types'

export interface MetadataTemplateFieldCatalogItemT {
  key: string
  groupCode: string
  fieldName: string
  display: string
}

export interface MetadataTemplateT {
  id: string
  name: string
  description: string
  sourceDossierId: string
  sourceOcrMetadataKey: string
  fieldCatalog: Array<MetadataTemplateFieldCatalogItemT>
  createdAt: string
  updatedAt: string
}

export interface MetadataTemplateDossierOptionT {
  id: string
  name: string
  folderPath: string
  status: string
  ocrMetadataKey: string
}

export interface CreateMetadataTemplatePayloadT {
  name: string
  description: string
  dossierId: string
}

export interface UpdateMetadataTemplatePayloadT {
  name: string
  description: string
}

export interface DocumentTypeTemplateT {
  id: string
  name: string
  description?: string
  sourceDossierId?: string
  sourceOcrMetadataKey?: string
  groups: Array<MetadataSchemaGroupT>
  createdAt?: string
  updatedAt?: string
}

export interface MetadataPermissionTemplateOptionT {
  id: string
  name: string
  updatedAt: string
}

export interface MetadataPermissionConfigListItemT {
  id: string
  name: string
  description: string
  templateId: string
  status: string
  createdAt: string
  updatedAt: string
  slotCount: number
  template: {
    id: string
    name: string
  }
}

export interface MetadataPermissionSlotT {
  slotCode: string
  slotName: string
  sortOrder: number
  fieldKeys: Array<string>
}

export interface MetadataPermissionConfigT {
  id: string
  name: string
  description: string
  templateId: string
  status: string
  createdAt: string
  updatedAt: string
  slotCount: number
  template: {
    id: string
    name: string
    fieldCatalog: Array<MetadataTemplateFieldCatalogItemT>
  }
  slots: Array<MetadataPermissionSlotT>
}

export interface CreateMetadataPermissionConfigPayloadT {
  name: string
  description: string
  templateId: string
}

export interface UpdateMetadataPermissionConfigSlotsPayloadT {
  slots: Array<MetadataPermissionSlotT>
}
