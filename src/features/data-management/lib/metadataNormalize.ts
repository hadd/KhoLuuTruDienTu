import type {
  DataDossierMetadataT,
  DataDocumentFieldT,
  DataMetadataGroupT,
} from '@/features/data-management/types'

export const TAI_LIEU_LUU_TRU_GROUP_CODE = 'TAI_LIEU_LUU_TRU'
export const TEN_LOAI_TAI_LIEU_FIELD = 'TEN_LOAI_TAI_LIEU'

/** Legacy OCR document_types.id ↔ TT05 TEN_LOAI slug catalog codes. */
export const METADATA_CATALOG_GROUP_ALIASES: Record<string, Array<string>> = {
  BAN_AN_QUYET_DINH: ['QUYET_DINH'],
  QUYET_DINH: ['BAN_AN_QUYET_DINH'],
  THI_HANH_XONG: ['BIEN_LAI'],
  BIEN_LAI: ['THI_HANH_XONG'],
}

export function resolveCatalogGroupAliasCodes(groupCode: string): Array<string> {
  const aliases = METADATA_CATALOG_GROUP_ALIASES[groupCode] ?? []
  return [groupCode, ...aliases]
}

export function slugifyTenLoaiTaiLieu(value: string): string {
  return value
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function resolveMetadataGroupCatalogCode(
  group: DataMetadataGroupT,
): string {
  if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
    const displayName = group.fields
      .find(
        (field) =>
          field.name.trim().toUpperCase() === TEN_LOAI_TAI_LIEU_FIELD,
      )
      ?.value?.trim()
    if (displayName) {
      return slugifyTenLoaiTaiLieu(displayName)
    }
  }

  return group.group_code
}

export type MetadataDocumentItemT = {
  source_document?: {
    file_name?: string
    file_path?: string
  }
  fields: Array<DataDocumentFieldT>
}

function getNestedDocuments(
  group: DataMetadataGroupT & { document?: MetadataDocumentItemT[] },
): MetadataDocumentItemT[] | null {
  const raw = group.documents ?? group.document
  if (!Array.isArray(raw) || raw.length === 0) return null
  return raw
}

function groupFileRef(group: DataMetadataGroupT): string {
  const filePath = group.source_document?.file_path?.trim() ?? ''
  const fileName = group.source_document?.file_name?.trim() ?? ''
  return filePath || fileName
}

export function groupMergeKey(group: DataMetadataGroupT, index: number): string {
  const fileRef = groupFileRef(group)
  return fileRef
    ? `${group.group_code}\0${fileRef}`
    : `${group.group_code}\0#${index}`
}

/** Expand `TAI_LIEU_LUU_TRU.documents[]` into flat groups (idempotent if already flat). */
export function expandTaiLieuDocuments(
  metadata: DataDossierMetadataT,
): DataDossierMetadataT {
  const expandedGroups: DataMetadataGroupT[] = []

  for (const group of metadata.metadata_groups) {
    const nestedDocuments = getNestedDocuments(
      group as DataMetadataGroupT & { document?: MetadataDocumentItemT[] },
    )
    if (
      group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE &&
      nestedDocuments &&
      nestedDocuments.length > 0
    ) {
      for (const item of nestedDocuments) {
        expandedGroups.push({
          group_code: group.group_code,
          group_name: group.group_name,
          source_document: item.source_document,
          fields: item.fields,
        })
      }
      continue
    }

    expandedGroups.push(group)
  }

  return { ...metadata, metadata_groups: expandedGroups }
}

/** Collapse consecutive flat `TAI_LIEU_LUU_TRU` groups into one group with `documents[]`. */
export function collapseTaiLieuDocuments(
  metadata: DataDossierMetadataT,
): DataDossierMetadataT {
  const collapsedGroups: DataMetadataGroupT[] = []
  let pendingTaiLieu: DataMetadataGroupT | null = null
  let pendingDocuments: MetadataDocumentItemT[] = []

  const flushTaiLieu = () => {
    if (!pendingTaiLieu || pendingDocuments.length === 0) return
    collapsedGroups.push({
      group_code: pendingTaiLieu.group_code,
      group_name: pendingTaiLieu.group_name,
      fields: [],
      documents: pendingDocuments,
    })
    pendingTaiLieu = null
    pendingDocuments = []
  }

  for (const group of metadata.metadata_groups) {
    const nestedDocuments = getNestedDocuments(
      group as DataMetadataGroupT & { document?: MetadataDocumentItemT[] },
    )
    if (nestedDocuments && nestedDocuments.length > 0) {
      flushTaiLieu()
      collapsedGroups.push({
        group_code: group.group_code,
        group_name: group.group_name,
        fields: [],
        documents: nestedDocuments,
      })
      continue
    }

    if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
      if (!pendingTaiLieu) {
        pendingTaiLieu = {
          group_code: group.group_code,
          group_name: group.group_name,
          fields: [],
        }
      }
      pendingDocuments.push({
        source_document: group.source_document,
        fields: group.fields,
      })
      continue
    }

    flushTaiLieu()
    collapsedGroups.push(group)
  }

  flushTaiLieu()
  return { ...metadata, metadata_groups: collapsedGroups }
}
