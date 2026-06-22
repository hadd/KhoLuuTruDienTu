import type { MetadataSchemaGroupT } from '@/features/group/types'

import type {
  DocumentTypeTemplateT,
  MetadataTemplateFieldCatalogItemT,
  MetadataTemplateT,
} from '@/features/data-config/types'

const DYNAMIC_GROUP_CODES = new Set([
  'DUONG_SU',
  'NGHIA_VU',
  'BAO_CAO_DOI_CHIEU',
])

function formatGroupCodeAsName(groupCode: string): string {
  return groupCode.replace(/_/g, ' ')
}

function isDynamicGroup(
  groupCode: string,
  fields: Array<MetadataTemplateFieldCatalogItemT>,
): boolean {
  if (DYNAMIC_GROUP_CODES.has(groupCode)) return true
  return fields.some((field) => /\s\d+$/.test(field.display))
}

export function fieldCatalogToGroups(
  fieldCatalog: Array<MetadataTemplateFieldCatalogItemT>,
): Array<MetadataSchemaGroupT> {
  const fieldsByGroup = new Map<
    string,
    Array<MetadataTemplateFieldCatalogItemT>
  >()

  for (const item of fieldCatalog) {
    const existing = fieldsByGroup.get(item.groupCode) ?? []
    existing.push(item)
    fieldsByGroup.set(item.groupCode, existing)
  }

  return Array.from(fieldsByGroup.entries()).map(([groupCode, fields]) => ({
    groupCode,
    groupName: fields[0]?.groupName || formatGroupCodeAsName(groupCode),
    isDynamic: isDynamicGroup(groupCode, fields),
    fields: fields.map((field) => ({
      key: field.key,
      name: field.fieldName,
      display: field.display,
    })),
  }))
}

export function mapMetadataTemplateToDocumentType(
  template: MetadataTemplateT,
): DocumentTypeTemplateT {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    sourceDossierId: template.sourceDossierId,
    sourceOcrMetadataKey: template.sourceOcrMetadataKey,
    groups: fieldCatalogToGroups(template.fieldCatalog),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export function filterDossierOptions(
  options: Array<{ name: string; folderPath: string }>,
  search: string,
): typeof options {
  const query = search.trim().toLowerCase()
  if (!query) return options

  return options.filter(
    (option) =>
      option.name.toLowerCase().includes(query) ||
      option.folderPath.toLowerCase().includes(query),
  )
}
