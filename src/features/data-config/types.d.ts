import type { MetadataSchemaGroupT } from '@/features/group/types'

export interface MetadataTemplateFieldCatalogItemT {
  key: string
  groupCode: string
  groupName: string
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

export type MetadataPermissionConfigStatusT = 'draft' | 'close' | 'ready'

export interface CreateMetadataPermissionConfigPayloadT {
  name: string
  description: string
  templateId: string
}

export interface UpdateMetadataPermissionConfigStatusPayloadT {
  status: Extract<MetadataPermissionConfigStatusT, 'close' | 'ready'>
}

export interface UpdateMetadataPermissionConfigSlotsPayloadT {
  slots: Array<MetadataPermissionSlotT>
}

export interface MetadataExportColumnConfigT {
  header: string
  fieldKeys: Array<string>
  separator: string
}

export interface MetadataExportPresetT {
  id: string
  name: string
  description: string
  columns: Array<MetadataExportColumnConfigT>
  createdAt: string
  updatedAt: string
}

export interface CreateMetadataExportPresetPayloadT {
  name: string
  description?: string | null
  columns: Array<MetadataExportColumnConfigT>
}

export interface UpdateMetadataExportPresetPayloadT {
  name: string
  description?: string | null
  columns: Array<MetadataExportColumnConfigT>
}

export interface MetadataExportFieldCatalogItemT {
  key: string
  groupCode: string
  groupName: string
  fieldName: string
  display: string
}
