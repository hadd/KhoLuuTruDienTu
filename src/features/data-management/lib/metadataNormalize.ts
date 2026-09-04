import type {
  DataDossierMetadataT,
  DataDocumentFieldT,
  DataMetadataGroupT,
} from '@/features/data-management/types'

export const TAI_LIEU_LUU_TRU_GROUP_CODE = 'TAI_LIEU_LUU_TRU'
export const HO_SO_LUU_TRU_GROUP_CODE = 'HO_SO_LUU_TRU'
export const HO_SO_FOND_FIELD = 'FOND'
export const TEN_LOAI_TAI_LIEU_FIELD = 'TEN_LOAI_TAI_LIEU'

/**
 * Fields that should be treated as date type even when the backend/template
 * marks them as 'string'. This ensures they render with a date picker
 * instead of a plain text input.
 */
const DATE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'THOI_GIAN_BAT_DAU',
  'THOI_GIAN_KET_THUC',
])

/**
 * Hardcoded metadata fields that should be hidden when reading JSON in Data Management.
 */
export const HIDDEN_METADATA_FIELD_NAMES: ReadonlySet<string> = new Set([
  'FOND',
  'PHONG_LUU_TRU',
  'TEN_PHONG',
  'MA_HO_SO',
  'MA_CO_QUAN_LUU_TRU_LICH_SU',
  'MA_PHONG',
  'MUC_LUC_SO',
  'MUC_LUC_SO_HOAC_NAM_HINH_THANH_HO_SO',
  'TONG_SO_VAN_BAN_TRONG_HO_SO',
  'CHU_GIAI',
  'KY_HIEU_THONG_TIN',
  'TU_KHOA',
  'TINH_TRANG_VAT_LY',
  'SO_LUONG_TRANG_CUA_VAN_BAN',
  'SO_LUONG_TO',
  'GHI_CHU',
  'BUT_TICH',
])

export function isHiddenMetadataFieldName(fieldName: string): boolean {
  if (!fieldName) return false
  return HIDDEN_METADATA_FIELD_NAMES.has(fieldName.trim().toUpperCase())
}

export function filterHiddenMetadataFields<T extends { name: string }>(
  fields: Array<T>,
): Array<T> {
  return fields.filter((field) => !isHiddenMetadataFieldName(field.name))
}


/**
 * Returns the effective field type, overriding 'string' → 'date' for
 * known date fields in HO_SO_LUU_TRU and TAI_LIEU_LUU_TRU.
 */
export function resolveEffectiveFieldType(
  groupCode: string,
  fieldName: string,
  declaredType: DataDocumentFieldT['type'],
  fieldDisplay?: string,
): DataDocumentFieldT['type'] {
  const normalizedName = fieldName.trim().toUpperCase()
  const normalizedDisplay = fieldDisplay?.trim()?.toUpperCase() ?? ''
  
  const isDateName = DATE_FIELD_NAMES.has(normalizedName) || 
                     normalizedName.includes('THOI_GIAN_BAT_DAU') || 
                     normalizedName.includes('THOI_GIAN_KET_THUC') ||
                     normalizedDisplay.includes('THỜI GIAN BẮT ĐẦU') ||
                     normalizedDisplay.includes('THỜI GIAN KẾT THÚC')

  if (
    (groupCode === HO_SO_LUU_TRU_GROUP_CODE || groupCode === TAI_LIEU_LUU_TRU_GROUP_CODE) &&
    isDateName
  ) {
    return 'date'
  }
  return declaredType
}

/** Legacy OCR document_types.id ↔ TT05 TEN_LOAI slug catalog codes. */
export const METADATA_CATALOG_GROUP_ALIASES: Record<string, Array<string>> = {
  BAN_AN_QUYET_DINH: ['QUYET_DINH'],
  QUYET_DINH: ['BAN_AN_QUYET_DINH'],
  THI_HANH_XONG: ['BIEN_LAI'],
  BIEN_LAI: ['THI_HANH_XONG'],
  PHONG_LUU_TRU: ['HO_SO_LUU_TRU'],
  HO_SO_LUU_TRU: ['PHONG_LUU_TRU'],
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

const DEFAULT_FOND_VALUE = ''

const LEGACY_FOND_FIELD_NAMES = [
  'PHONG_LUU_TRU',
  'TEN_PHONG',
  'MA_PHONG',
] as const

function isLegacyFondFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toUpperCase()
  return LEGACY_FOND_FIELD_NAMES.some((name) => name === normalized)
}

function findFieldValue(
  fields: Array<DataDocumentFieldT>,
  fieldName: string,
): string | null {
  const normalizedName = fieldName.trim().toUpperCase()
  for (const field of fields) {
    if (field.name.trim().toUpperCase() !== normalizedName) continue
    const value = field.value?.trim()
    if (value) return value
  }
  return null
}

function resolveLegacyFondValue(
  phongGroup: DataDossierMetadataT['metadata_groups'][number] | undefined,
  hoSoFields: Array<DataDocumentFieldT>,
): string {
  if (phongGroup) {
    return (
      findFieldValue(phongGroup.fields, 'TEN_PHONG') ??
      findFieldValue(phongGroup.fields, 'MA_PHONG') ??
      DEFAULT_FOND_VALUE
    )
  }

  return (
    findFieldValue(hoSoFields, HO_SO_FOND_FIELD) ??
    findFieldValue(hoSoFields, 'PHONG_LUU_TRU') ??
    findFieldValue(hoSoFields, 'TEN_PHONG') ??
    findFieldValue(hoSoFields, 'MA_PHONG') ??
    DEFAULT_FOND_VALUE
  )
}

/** Drop PHONG_LUU_TRU group/field and legacy fond fields. */
export function migrateTt05MetadataLayout(
  metadata: DataDossierMetadataT,
): DataDossierMetadataT {
  const migrated = structuredClone(metadata) as DataDossierMetadataT

  migrated.metadata_groups = migrated.metadata_groups.filter(
    (group) => group.group_code !== 'PHONG_LUU_TRU',
  )

  const hoSoGroup = migrated.metadata_groups.find(
    (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
  )
  if (hoSoGroup) {
    hoSoGroup.fields = hoSoGroup.fields.filter(
      (field) =>
        field.name.trim().toUpperCase() !== HO_SO_FOND_FIELD &&
        !isLegacyFondFieldName(field.name),
    )
  }

  return migrated
}

export function ensureHoSoFondField(
  metadata: DataDossierMetadataT,
  _fondId?: string | null,
): DataDossierMetadataT {
  return migrateTt05MetadataLayout(metadata)
}

export function isHoSoFondMetadataField(
  groupCode: string,
  fieldName: string,
): boolean {
  return (
    groupCode === HO_SO_LUU_TRU_GROUP_CODE &&
    fieldName.trim().toUpperCase() === HO_SO_FOND_FIELD
  )
}

export function findHoSoFondFieldValue(
  metadata: DataDossierMetadataT | null | undefined,
): string | null {
  const hoSoGroup = metadata?.metadata_groups.find(
    (group) => group.group_code === HO_SO_LUU_TRU_GROUP_CODE,
  )
  return findFieldValue(hoSoGroup?.fields ?? [], HO_SO_FOND_FIELD)
}

export function hasHoSoFondField(
  _metadata: DataDossierMetadataT | null | undefined,
): boolean {
  return false
}

const HO_SO_RETENTION_FIELD = 'THOI_HAN_LUU_TRU'

export function isHoSoRetentionMetadataField(
  groupCode: string,
  fieldName: string,
): boolean {
  return (
    groupCode === HO_SO_LUU_TRU_GROUP_CODE &&
    fieldName.trim().toUpperCase() === HO_SO_RETENTION_FIELD
  )
}

const HO_SO_ACCESS_LEVEL_FIELD = 'MUC_DO_TIEP_CAN'

export function isAccessLevelMetadataField(
  groupCode: string,
  fieldName: string,
): boolean {
  return (
    (groupCode === HO_SO_LUU_TRU_GROUP_CODE || groupCode === TAI_LIEU_LUU_TRU_GROUP_CODE) &&
    fieldName.trim().toUpperCase() === HO_SO_ACCESS_LEVEL_FIELD
  )
}

