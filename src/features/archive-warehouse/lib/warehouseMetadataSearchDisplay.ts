import type {
  ArchiveWarehouseSearchHitT,
  ArchiveWarehouseSearchMatchT,
} from '@/features/archive-warehouse/types'
import {
  findOriginalSpanForNormalizedMatch,
  normalizeSearchText,
  textMatchesSearchQuery,
} from '@/lib/utils/vietnamese-search'

export const WAREHOUSE_TT05_SEARCHABLE_FIELDS = [
  { value: 'MA_HO_SO', label: 'Mã hồ sơ' },
  { value: 'TIEU_DE_HO_SO', label: 'Tiêu đề hồ sơ' },
  { value: 'MA_DINH_DANH_TAI_LIEU', label: 'Mã định danh tài liệu' },
  { value: 'MA_LUU_TRU_TAI_LIEU', label: 'Mã lưu trữ tài liệu' },
  { value: 'TEN_LOAI_TAI_LIEU', label: 'Tên loại tài liệu' },
  { value: 'SO_CUA_TAI_LIEU', label: 'Số của tài liệu' },
  { value: 'KY_HIEU_CUA_TAI_LIEU', label: 'Ký hiệu của tài liệu' },
  { value: 'TEN_CO_QUAN_BAN_HANH', label: 'Tên cơ quan ban hành' },
  { value: 'TRICH_YEU_NOI_DUNG', label: 'Trích yếu nội dung' },
  { value: 'NGON_NGU', label: 'Ngôn ngữ' },
  { value: 'BUT_TICH', label: 'Bút tích' },
  { value: 'QUY_TRINH_XU_LY', label: 'Quy trình xử lý' },
  { value: 'CHE_DO_LAP_TAI_LIEU_DU_PHONG', label: 'Chế độ lập tài liệu dự phòng' },
  {
    value: 'TINH_TRANG_LAP_TAI_LIEU_DU_PHONG',
    label: 'Tình trạng lập tài liệu dự phòng',
  },
  { value: 'TU_KHOA', label: 'Từ khóa' },
] as const

const TT05_LABEL_BY_VALUE = new Map(
  WAREHOUSE_TT05_SEARCHABLE_FIELDS.map((field) => [field.value, field.label]),
)

const CATALOG_FIELD_LABELS: Record<string, string> = {
  FOND: 'Phông',
  MA_PHONG: 'Phông',
  DOSSIER_TYPE: 'Loại hồ sơ',
  TEN_LOAI_HO_SO: 'Loại hồ sơ',
  DOCUMENT_TYPE: 'Loại tài liệu',
  TEN_LOAI_TAI_LIEU: 'Tên loại tài liệu',
  MA_HO_SO: 'Mã hồ sơ',
  TIEU_DE_HO_SO: 'Tiêu đề hồ sơ',
  TEN_TAI_LIEU: 'Tên tài liệu',
}

export type WarehouseMetadataSearchLineT = {
  fieldKey: string
  label: string
  valueHtml: string
  fileName?: string | null
}

export function normalizeWarehouseSearchFields(
  searchFields: string | string[] | undefined,
): string[] {
  if (Array.isArray(searchFields)) {
    return searchFields.filter((field) => field.trim().length > 0)
  }
  if (!searchFields?.trim()) return []
  return [searchFields.trim()]
}

export function hasWarehouseMetadataFieldSearch(
  searchFields: string | string[] | undefined,
): boolean {
  return normalizeWarehouseSearchFields(searchFields).length > 0
}

function resolveFieldLabel(fieldKey: string, match?: ArchiveWarehouseSearchMatchT) {
  if (match?.display?.trim()) return match.display.trim()
  return TT05_LABEL_BY_VALUE.get(fieldKey) ?? CATALOG_FIELD_LABELS[fieldKey] ?? fieldKey
}

function matchFieldKey(
  match: ArchiveWarehouseSearchMatchT,
  fieldKey: string,
): boolean {
  const compoundKey =
    match.groupCode && match.name ? `${match.groupCode}.${match.name}` : match.name
  return fieldKey === match.name || fieldKey === compoundKey
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textMatchesQuery(value: string, q?: string): boolean {
  return textMatchesSearchQuery(value, q)
}

function highlightAccentInsensitive(text: string, q: string): string | null {
  const trimmed = text.trim()
  const query = q.trim()
  if (!trimmed || !query) return null

  const literalRegex = new RegExp(escapeRegExp(query), 'gi')
  if (literalRegex.test(trimmed)) {
    literalRegex.lastIndex = 0
    return escapeHtml(trimmed).replace(literalRegex, (match) => `<mark>${match}</mark>`)
  }

  const normalizedText = normalizeSearchText(trimmed)
  const normalizedQuery = normalizeSearchText(query)
  const matchIndex = normalizedText.indexOf(normalizedQuery)
  if (matchIndex === -1) return null

  const span = findOriginalSpanForNormalizedMatch(
    trimmed,
    matchIndex,
    normalizedQuery.length,
  )
  if (!span) {
    return `<mark>${escapeHtml(trimmed)}</mark>`
  }

  const before = escapeHtml(trimmed.slice(0, span.start))
  const matched = escapeHtml(trimmed.slice(span.start, span.end))
  const after = escapeHtml(trimmed.slice(span.end))
  return `${before}<mark>${matched}</mark>${after}`
}

function toValueHtml(raw: string, q?: string): string {
  if (/<(?:mark|em)\b/i.test(raw)) return raw
  return highlightSearchQuery(raw, q)
}

/** Highlight search query in plain text; preserve existing ES mark/em tags. */
export function highlightSearchQuery(text: string, q?: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (/<(?:mark|em)\b/i.test(trimmed)) return trimmed

  const query = q?.trim()
  if (!query) return escapeHtml(trimmed)
  if (!textMatchesQuery(trimmed, query)) return escapeHtml(trimmed)

  return highlightAccentInsensitive(trimmed, query) ?? escapeHtml(trimmed)
}

function filterValuesByQuery(values: string[], q?: string): string[] {
  const filtered = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => textMatchesQuery(value, q))

  if (filtered.length > 0) return [...new Set(filtered)]

  // When ES matched but tokenization differs, match by all query tokens (accent-insensitive).
  const query = q?.trim()
  if (!query) return [...new Set(values.map((value) => value.trim()).filter(Boolean))]

  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const tokenFiltered = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      const normalizedValue = normalizeSearchText(value)
      return tokens.every((token) => normalizedValue.includes(token))
    })

  return [...new Set(tokenFiltered)]
}

function resolveCatalogValues(
  hit: ArchiveWarehouseSearchHitT,
  fieldKey: string,
  q?: string,
): string[] {
  switch (fieldKey) {
    case 'FOND':
    case 'MA_PHONG':
      return hit.fondName?.trim() && textMatchesQuery(hit.fondName, q)
        ? [hit.fondName.trim()]
        : []
    case 'DOSSIER_TYPE':
    case 'TEN_LOAI_HO_SO':
      return hit.dossierTypeName?.trim() && textMatchesQuery(hit.dossierTypeName, q)
        ? [hit.dossierTypeName.trim()]
        : []
    case 'DOCUMENT_TYPE':
    case 'TEN_LOAI_TAI_LIEU':
      return filterValuesByQuery(hit.documentTypeNames ?? [], q)
    case 'MA_HO_SO':
      return hit.hoSoId?.trim() && textMatchesQuery(hit.hoSoId, q)
        ? [hit.hoSoId.trim()]
        : []
    case 'TIEU_DE_HO_SO':
      return hit.title?.trim() && textMatchesQuery(hit.title, q)
        ? [hit.title.trim()]
        : []
    case 'TEN_TAI_LIEU':
      return filterValuesByQuery(hit.fileNames ?? [], q)
    default:
      return []
  }
}

function joinHighlightedValues(values: string[], q?: string): string {
  return values.map((value) => toValueHtml(value, q)).join(', ')
}

/** Nested inner_hit from a specific document in the dossier. */
function isNestedDocumentMatch(match: ArchiveWarehouseSearchMatchT): boolean {
  return Boolean(match.groupCode?.trim() || match.fileName?.trim())
}

function matchDisplayHtml(
  match: ArchiveWarehouseSearchMatchT,
  q?: string,
): string {
  const highlight = match.highlight?.trim()
  if (highlight && /<(mark|em)\b/i.test(highlight)) return highlight
  const value = match.value?.trim()
  return value ? toValueHtml(value, q) : ''
}

function pushNestedDocumentLines(
  lines: Array<WarehouseMetadataSearchLineT>,
  fieldKey: string,
  matches: Array<ArchiveWarehouseSearchMatchT>,
  q?: string,
) {
  const seen = new Set<string>()

  for (const match of matches) {
    const plainValue = match.value?.trim()
    if (!plainValue || !textMatchesQuery(plainValue, q)) continue

    const dedupeKey = `${plainValue}::${match.fileName ?? ''}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const valueHtml = matchDisplayHtml(match, q)
    if (!valueHtml) continue

    lines.push({
      fieldKey,
      label: resolveFieldLabel(fieldKey, match),
      valueHtml,
      fileName: match.fileName ?? null,
    })
  }
}

function pushCatalogMatchLine(
  lines: Array<WarehouseMetadataSearchLineT>,
  fieldKey: string,
  matches: Array<ArchiveWarehouseSearchMatchT>,
  q?: string,
) {
  const uniqueValues = [
    ...new Set(
      matches
        .map((match) => match.highlight?.trim() || match.value?.trim())
        .filter((value): value is string => Boolean(value))
        .filter((value) => textMatchesQuery(value.replace(/<[^>]+>/g, ''), q)),
    ),
  ]
  if (uniqueValues.length === 0) return

  lines.push({
    fieldKey,
    label: resolveFieldLabel(fieldKey, matches[0]),
    valueHtml: joinHighlightedValues(
      uniqueValues.map((value) => value.replace(/<[^>]+>/g, '')),
      q,
    ),
  })
}

export function resolveWarehouseMetadataSearchLines(
  hit: ArchiveWarehouseSearchHitT,
  searchFields: string | string[] | undefined,
  q?: string,
): Array<WarehouseMetadataSearchLineT> {
  const selectedFields = normalizeWarehouseSearchFields(searchFields)
  if (selectedFields.length === 0) return []

  const lines: Array<WarehouseMetadataSearchLineT> = []

  for (const fieldKey of selectedFields) {
    const fieldMatches =
      hit.matches?.filter((match) => matchFieldKey(match, fieldKey)) ?? []

    if (fieldMatches.length > 0) {
      const nestedMatches = fieldMatches.filter(isNestedDocumentMatch)
      const catalogMatches = fieldMatches.filter(
        (match) => !isNestedDocumentMatch(match),
      )

      if (nestedMatches.length > 0) {
        pushNestedDocumentLines(lines, fieldKey, nestedMatches, q)
        continue
      }

      if (catalogMatches.length > 0) {
        pushCatalogMatchLine(lines, fieldKey, catalogMatches, q)
        continue
      }
    }

    const catalogValues = resolveCatalogValues(hit, fieldKey, q)
    if (catalogValues.length === 0) continue

    lines.push({
      fieldKey,
      label: resolveFieldLabel(fieldKey),
      valueHtml: joinHighlightedValues(catalogValues, q),
    })
  }

  return lines
}
