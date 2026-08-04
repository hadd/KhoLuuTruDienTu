import type { KeyboardEvent } from 'react'

import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { isFieldAllowed } from '@/features/data-config/lib/assignmentHelpers'
import {
  coerceMetadataText,
  resolveMetadataValueForSave,
} from '@/features/data-management/lib/metadataDate'
import {
  collapseTaiLieuDocuments,
  ensureHoSoFondField,
  expandTaiLieuDocuments,
  groupMergeKey,
  HO_SO_FOND_FIELD,
  HO_SO_LUU_TRU_GROUP_CODE,
  resolveCatalogGroupAliasCodes,
  resolveMetadataGroupCatalogCode,
  TAI_LIEU_LUU_TRU_GROUP_CODE,
  TEN_LOAI_TAI_LIEU_FIELD,
} from '@/features/data-management/lib/metadataNormalize'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataMetadataGroupT,
  DataRecordInfoFieldT,
  DataTreeNodeT,
  DossierFilesResponseT,
  MakerClaimT,
} from '@/features/data-management/types'
import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'

/** QC/manager see full metadata; editors with field ACL keep filtered groups (null values kept). */
export function resolveRecordPanelMetadata(
  node: Pick<
    DataTreeNodeT,
    'dossierMetadata' | 'fullDossierMetadata' | 'allowedFields'
  >,
  role: DataManagementRole,
): DataDossierMetadataT | undefined {
  const full = node.fullDossierMetadata ?? node.dossierMetadata
  const filtered = node.dossierMetadata ?? full
  if (!full && !filtered) return undefined

  if (role === 'qc' || role === 'manager' || role === 'admin') {
    return full ?? filtered
  }

  if (!node.allowedFields?.length) {
    return full ?? filtered
  }

  return filtered ?? undefined
}

/** Convert API size in KB (totalSizeKb / fileSizeKb) to bytes for tree nodes. */
export function sizeKbToBytes(kb: unknown): number {
  const n = Number(kb)
  return Number.isFinite(n) && n >= 0 ? n * 1024 : 0
}

export interface MetadataGroup {
  group_code?: string
  group_name?: string
  source_document?: {
    file_path?: string
    filePath?: string
    file_name?: string
  }
  fields?: Array<DataDocumentFieldT>
}

function isValidBbox(box: unknown): box is [number, number, number, number] {
  if (!Array.isArray(box) || box.length !== 4) return false
  const [x1, y1, x2, y2] = box.map((value) => Number(value))
  if (![x1, y1, x2, y2].every(Number.isFinite)) return false
  return x2 > x1 && y2 > y1
}

function normalizeBboxes(
  raw: unknown,
): Array<[number, number, number, number]> {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isValidBbox)
    .map(
      (box) =>
        box.map((value) => Number(value)) as [number, number, number, number],
    )
}

function normalizeField(field: Record<string, unknown>): DataDocumentFieldT {
  const rawType = String(field.type ?? 'string')
  const fieldType: DataDocumentFieldT['type'] =
    rawType === 'date' ||
    rawType === 'number' ||
    rawType === 'boolean' ||
    rawType === 'object'
      ? rawType
      : 'string'

  const rawPage = field.page
  const page =
    rawPage === null || rawPage === undefined
      ? 0
      : Number.isFinite(Number(rawPage))
        ? Number(rawPage)
        : 0

  const rawPageWidth = field.page_width
  const rawPageHeight = field.page_height
  // OCR pipeline should emit page_width/page_height (raster pixels) per field for precise bbox overlay.
  const pageWidth =
    rawPageWidth != null && Number.isFinite(Number(rawPageWidth))
      ? Number(rawPageWidth)
      : undefined
  const pageHeight =
    rawPageHeight != null && Number.isFinite(Number(rawPageHeight))
      ? Number(rawPageHeight)
      : undefined

  return {
    name: String(field.name ?? ''),
    display: String(field.display ?? field.name ?? ''),
    type: fieldType,
    value: field.value == null ? null : coerceMetadataText(field.value),
    page,
    bboxes: normalizeBboxes(
      field.bboxes ??
        (isValidBbox(field.bbox) ? [field.bbox] : undefined),
    ),
    ...(pageWidth && pageHeight
      ? { page_width: pageWidth, page_height: pageHeight }
      : {}),
  }
}

const DRAFT_CUSTOM_FIELD_PREFIX = 'custom_field_'

const METADATA_ROOT_RESERVED_KEYS = new Set([
  'metadata_groups',
  'general_fields',
  'thong_tin_chung',
])

function isScalarRootMetadataValue(value: unknown): boolean {
  return value == null || typeof value !== 'object'
}

function parseRootScalarFields(
  record: Record<string, unknown>,
): Array<DataRecordInfoFieldT> {
  const fields: Array<DataRecordInfoFieldT> = []
  const seen = new Set<string>()

  for (const [key, value] of Object.entries(record)) {
    if (METADATA_ROOT_RESERVED_KEYS.has(key)) continue
    if (key === 'ho_so_id' || key === 'trang_thai_ho_so') continue
    if (!isScalarRootMetadataValue(value)) continue

    const name = key.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    fields.push({ name, value: coerceMetadataText(value) })
  }

  return fields
}

function mergeGeneralFieldLists(
  ...lists: Array<Array<DataRecordInfoFieldT>>
): Array<DataRecordInfoFieldT> {
  const merged = new Map<string, DataRecordInfoFieldT>()
  for (const list of lists) {
    for (const field of list) {
      const name = field.name.trim()
      if (!name) continue
      merged.set(name, { name, value: field.value })
    }
  }
  return [...merged.values()]
}

export function createDraftCustomField(index: number): DataDocumentFieldT {
  return {
    name: `${DRAFT_CUSTOM_FIELD_PREFIX}${Date.now()}_${index}`,
    display: '',
    type: 'string',
    value: '',
    page: 0,
    bboxes: [],
  }
}

export function isDraftCustomField(field: DataDocumentFieldT): boolean {
  return (
    field.page === 0 &&
    field.bboxes.length === 0 &&
    field.name.startsWith(DRAFT_CUSTOM_FIELD_PREFIX)
  )
}

export function normalizeSavedCustomFields(
  fields: Array<DataDocumentFieldT>,
): Array<DataDocumentFieldT> {
  return fields.map((field) => {
    if (!isDraftCustomField(field)) return field
    const label = field.display.trim()
    if (!label) return field
    return { ...field, name: label, display: label }
  })
}

function normalizeMetadataGroup(
  group: Record<string, unknown>,
): DataMetadataGroupT {
  const fields = Array.isArray(group.fields)
    ? group.fields.map((field) =>
        normalizeField(field as Record<string, unknown>),
      )
    : []

  const rawDocuments = Array.isArray(group.documents)
    ? group.documents
    : Array.isArray(group.document)
      ? group.document
      : null
  const documents = rawDocuments
    ? rawDocuments.map((item) => {
        const record = item as Record<string, unknown>
        const source = record.source_document as Record<string, unknown> | undefined
        return {
          source_document: source
            ? {
                file_name: String(source.file_name ?? ''),
                file_path: String(source.file_path ?? source.filePath ?? ''),
              }
            : undefined,
          fields: Array.isArray(record.fields)
            ? record.fields.map((field) =>
                normalizeField(field as Record<string, unknown>),
              )
            : [],
        }
      })
    : undefined

  return {
    group_code: String(group.group_code ?? ''),
    group_name: String(group.group_name ?? group.group_code ?? ''),
    source_document: group.source_document
      ? {
          file_name: String(
            (group.source_document as Record<string, unknown>).file_name ?? '',
          ),
          file_path: String(
            (group.source_document as Record<string, unknown>).file_path ??
              (group.source_document as Record<string, unknown>).filePath ??
              '',
          ),
        }
      : undefined,
    fields,
    ...(documents ? { documents } : {}),
  }
}

function parseGeneralFields(
  record: Record<string, unknown>,
): Array<DataRecordInfoFieldT> {
  const rawFields = record.general_fields ?? record.thong_tin_chung
  if (!Array.isArray(rawFields)) return []

  return rawFields
    .map((field) => {
      const item = field as Record<string, unknown>
      const name = String(item.name ?? '')
      const value = coerceMetadataText(item.value)
      if (!name) return null
      return { name, value }
    })
    .filter((field): field is DataRecordInfoFieldT => field != null)
}

export function parseDossierMetadata(
  json: unknown,
): DataDossierMetadataT | undefined {
  if (!json || typeof json !== 'object') return undefined

  let record = json as Record<string, unknown>
  let groupsRaw: unknown[] = []

  if (Array.isArray(json)) {
    if (json.length > 0 && typeof json[0] === 'object' && 'metadata_groups' in json[0]) {
      record = json[0] as Record<string, unknown>
      groupsRaw = json.flatMap((item: any) => 
        Array.isArray(item?.metadata_groups) ? item.metadata_groups : []
      )
    } else {
      groupsRaw = json
    }
  } else {
    groupsRaw = Array.isArray(record.metadata_groups)
      ? record.metadata_groups
      : []
  }
  
  const groups = groupsRaw.map((group) =>
    normalizeMetadataGroup(group as Record<string, unknown>),
  )
  const generalFields = mergeGeneralFieldLists(
    parseGeneralFields(record),
    parseRootScalarFields(record),
  )

  if (
    groups.length === 0 &&
    generalFields.length === 0 &&
    !record.ho_so_id &&
    !record.trang_thai_ho_so
  ) {
    return undefined
  }

  return ensureHoSoFondField(
    expandTaiLieuDocuments({
      ho_so_id: record.ho_so_id != null ? String(record.ho_so_id) : undefined,
      trang_thai_ho_so:
        record.trang_thai_ho_so != null
          ? String(record.trang_thai_ho_so)
          : undefined,
      general_fields: generalFields.length > 0 ? generalFields : undefined,
      metadata_groups: groups,
    }),
  )
}

/** Flatten internal metadata to root-level JSON for MinIO storage. */
export function serializeDossierMetadataForStorage(
  metadata: DataDossierMetadataT,
): Record<string, unknown> {
  const collapsed = collapseTaiLieuDocuments(metadata)
  const result: Record<string, unknown> = {
    metadata_groups: collapsed.metadata_groups,
  }

  if (metadata.ho_so_id != null && metadata.ho_so_id !== '') {
    result.ho_so_id = metadata.ho_so_id
  }
  if (metadata.trang_thai_ho_so != null && metadata.trang_thai_ho_so !== '') {
    result.trang_thai_ho_so = metadata.trang_thai_ho_so
  }

  for (const field of metadata.general_fields ?? []) {
    const name = field.name.trim()
    if (!name) continue
    if (
      name === 'ho_so_id' ||
      name === 'trang_thai_ho_so' ||
      METADATA_ROOT_RESERVED_KEYS.has(name)
    ) {
      continue
    }
    result[name] = field.value
  }

  return result
}

/** Unwrap `{ metadata }`, `{ record: { metadata } }`, or raw dossier metadata payloads. */
export function extractDossierMetadataPayload(
  data: unknown,
): DataDossierMetadataT | undefined {
  if (!data || typeof data !== 'object') return undefined

  const record = data as Record<string, unknown>
  if (record.metadata != null) {
    const parsedMeta = typeof record.metadata === 'string'
      ? parseMetadataResponseBody(record.metadata)
      : record.metadata

    return (
      parseDossierMetadata(parsedMeta) ??
      (parsedMeta as DataDossierMetadataT)
    )
  }

  if (record.record != null && typeof record.record === 'object') {
    return extractDossierMetadataPayload(record.record)
  }

  const parsedData = typeof data === 'string' ? parseMetadataResponseBody(data) : data
  return parseDossierMetadata(parsedData)
}

export function sanitizeFileRef(str: string): string {
  return (str || '').replace(/\.pdf(f)?$/i, '').trim()
}

function getFileBasename(ref: string): string {
  const sanitized = sanitizeFileRef(ref)
  const segments = sanitized.split(/[/\\]/).filter(Boolean)
  return segments.at(-1) ?? sanitized
}

function getMetadataGroupRef(
  group: MetadataGroup | DataMetadataGroupT,
): string {
  if (!group.source_document) return ''
  const filePath = group.source_document.file_path?.trim()
  const fileName = group.source_document.file_name?.trim()
  return filePath || fileName || ''
}

const GENERIC_METADATA_GROUP_KEYS = new Set([
  'group_name',
  'group_code',
  'group',
])

function isGenericMetadataGroupKey(value: string): boolean {
  return GENERIC_METADATA_GROUP_KEYS.has(value.trim().toLowerCase())
}

function pickBestPathMatch<
  T extends { group: DataMetadataGroupT; index: number },
>(entries: Array<T>): T | undefined {
  if (entries.length === 0) return undefined
  return entries.reduce((best, current) => {
    const bestRef = sanitizeFileRef(getMetadataGroupRef(best.group))
    const currentRef = sanitizeFileRef(getMetadataGroupRef(current.group))
    return currentRef.length > bestRef.length ? current : best
  })
}

function groupLabelMatchesDocument(
  group: DataMetadataGroupT,
  document: DataTreeNodeT,
): boolean {
  const fileRef = resolveDocumentFileRef(document)
  const candidates = [
    group.group_name,
    group.group_code,
    group.source_document?.file_name,
  ]
    .map((value) => value?.trim())
    .filter(Boolean) as Array<string>

  return candidates.some(
    (candidate) =>
      !isGenericMetadataGroupKey(candidate) &&
      fileRefsMatch(fileRef, candidate),
  )
}

export function isInternalMetadataField(field: DataDocumentFieldT): boolean {
  return isGenericMetadataGroupKey(field.name)
}

export function getVisibleMetadataFields(
  fields: Array<DataDocumentFieldT>,
): Array<DataDocumentFieldT> {
  return fields.filter((field) => !isInternalMetadataField(field))
}

export function findMetadataGroupIndexForDocument(
  groups: Array<DataMetadataGroupT>,
  document: DataTreeNodeT,
  documents?: Array<DataTreeNodeT>,
): number {
  if (groups.length === 0) return 0

  const fileRef = resolveDocumentFileRef(document)
  const pathMatches = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => {
      if (!group.source_document) return false
      return fileRefsMatch(fileRef, getMetadataGroupRef(group))
    })

  if (pathMatches.length > 0) {
    const bestPathMatch = pickBestPathMatch(pathMatches)
    if (bestPathMatch) return bestPathMatch.index
    return pathMatches[0].index
  }

  const labelMatch = groups.findIndex((group) =>
    groupLabelMatchesDocument(group, document),
  )
  if (labelMatch >= 0) return labelMatch

  if (documents && documents.length > 0 && documents.length === groups.length) {
    const documentIndex = documents.findIndex((item) => item.id === document.id)
    if (documentIndex >= 0) return documentIndex
  }

  return 0
}

export function findAllDocumentsForMetadataGroup(
  group: DataMetadataGroupT,
  documents: Array<DataTreeNodeT>,
): Array<DataTreeNodeT> {
  const groupRef = getMetadataGroupRef(group)
  const seen = new Set<string>()
  const matches: Array<DataTreeNodeT> = []

  function add(document: DataTreeNodeT) {
    if (seen.has(document.id)) return
    seen.add(document.id)
    matches.push(document)
  }

  if (groupRef) {
    for (const document of documents) {
      if (fileRefsMatch(resolveDocumentFileRef(document), groupRef)) {
        add(document)
      }
    }
  }

  for (const document of documents) {
    if (groupLabelMatchesDocument(group, document)) {
      add(document)
    }
  }

  return matches
}

export function findDocumentForMetadataGroup(
  group: DataMetadataGroupT,
  documents: Array<DataTreeNodeT>,
): DataTreeNodeT | undefined {
  return findAllDocumentsForMetadataGroup(group, documents)[0]
}

export function findAllMetadataGroupIndicesForDocument(
  groups: Array<DataMetadataGroupT>,
  document: DataTreeNodeT,
  documents?: Array<DataTreeNodeT>,
): Array<number> {
  if (groups.length === 0) return []

  const fileRef = resolveDocumentFileRef(document)
  const pathMatches = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => {
      if (!group.source_document) return false
      return fileRefsMatch(fileRef, getMetadataGroupRef(group))
    })

  if (pathMatches.length > 0) {
    return pathMatches.map(({ index }) => index)
  }

  const labelMatches = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => groupLabelMatchesDocument(group, document))

  if (labelMatches.length > 0) {
    return labelMatches.map(({ index }) => index)
  }

  if (documents && documents.length > 0 && documents.length === groups.length) {
    const documentIndex = documents.findIndex((item) => item.id === document.id)
    if (documentIndex >= 0) return [documentIndex]
  }

  return []
}

/** Nhãn nhóm metadata: ưu tiên `group_name` từ API (vd. "Bản án, quyết định"). */
export function getMetadataGroupDisplayName(
  group: DataMetadataGroupT,
  catalogNameByCode?: ReadonlyMap<string, string>,
): string {
  const catalogName = catalogNameByCode?.get(group.group_code.trim())?.trim()
  if (catalogName) return catalogName

  const groupName = group.group_name.trim()
  if (groupName && !isGenericMetadataGroupKey(groupName)) return groupName

  const groupCode = group.group_code.trim()
  if (groupCode && !isGenericMetadataGroupKey(groupCode)) return groupCode

  const sourceFileName = group.source_document?.file_name?.trim()
  if (sourceFileName) {
    return getFileBasename(sanitizeFileRef(sourceFileName)) || sourceFileName
  }

  return groupName || groupCode
}

export interface MetadataGroupListEntryT {
  key: string
  label: string
  displayPath: string
  groupIndex: number
}

/** Đường dẫn PDF từ `source_document` trong metadata (không suy ra từ cây thư mục). */
export function resolveMetadataGroupSourceDocumentPath(
  group: DataMetadataGroupT,
  dossierFolderHint?: string,
): string {
  const filePath = group.source_document?.file_path?.trim()
  if (filePath) return formatMetadataFilePath(filePath)

  const fileName = group.source_document?.file_name?.trim()
  if (fileName && dossierFolderHint) {
    return formatMetadataFilePath(`raw/${dossierFolderHint}/${fileName}`)
  }

  if (fileName) return formatMetadataFilePath(fileName)
  return ''
}

export function buildMetadataGroupListEntries(
  groups: Array<DataMetadataGroupT>,
  dossierFolderHint?: string,
): Array<MetadataGroupListEntryT> {
  return groups.map((group, index) => ({
    key: `${group.group_code}-${index}`,
    label: getMetadataGroupDisplayName(group),
    displayPath: resolveMetadataGroupSourceDocumentPath(
      group,
      dossierFolderHint,
    ),
    groupIndex: index,
  }))
}

/** Full file path breadcrumb, e.g. `raw/385_CD/file.pdf` → `raw > 385_CD > file.pdf`. */
export function formatMetadataFilePath(filePath: string): string {
  const segments = filePath.trim().split(/[/\\]/).filter(Boolean)
  return segments.join(' > ')
}

/** @deprecated Use {@link formatMetadataFilePath} */
export function formatMetadataFolderPath(filePath: string): string {
  return formatMetadataFilePath(filePath)
}

export function resolveMetadataGroupDisplayPath(
  group: DataMetadataGroupT,
  documents: Array<DataTreeNodeT>,
  dossierFolderHint?: string,
): string {
  const filePath = group.source_document?.file_path?.trim()
  const fileName = group.source_document?.file_name?.trim()

  if (filePath && /[/\\]/.test(filePath)) {
    return formatMetadataFilePath(filePath)
  }

  const matchedDocument = findDocumentForMetadataGroup(group, documents)
  if (matchedDocument?.filePath) {
    return formatMetadataFilePath(matchedDocument.filePath)
  }

  if (fileName && dossierFolderHint) {
    return formatMetadataFilePath(`raw/${dossierFolderHint}/${fileName}`)
  }

  if (filePath) return formatMetadataFilePath(filePath)
  if (fileName) return formatMetadataFilePath(fileName)
  return ''
}

export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function fileRefsMatch(fileRef: string, groupRef: string): boolean {
  const cleanChild = removeVietnameseDiacritics(sanitizeFileRef(fileRef)).toLowerCase()
  const cleanGroup = removeVietnameseDiacritics(sanitizeFileRef(groupRef)).toLowerCase()
  if (!cleanChild || !cleanGroup) return false

  if (cleanChild === cleanGroup) return true

  if (
    cleanChild.endsWith(`/${cleanGroup}`) ||
    cleanChild.endsWith(`\\${cleanGroup}`)
  ) {
    return true
  }

  const suffixIndex = cleanChild.length - cleanGroup.length
  if (suffixIndex > 0 && cleanChild.endsWith(cleanGroup)) {
    const separator = cleanChild[suffixIndex - 1]
    if (separator === '/' || separator === '\\') return true
  }

  const childBasename = getFileBasename(cleanChild)
  const groupBasename = getFileBasename(cleanGroup)
  return Boolean(childBasename) && childBasename === groupBasename
}

export function matchMetadataFields(
  fileRef: string,
  metadataGroups: Array<MetadataGroup>,
): Array<DataDocumentFieldT> | undefined {
  if (metadataGroups.length === 0) return undefined

  const matchingGroups = metadataGroups.filter((group) => {
    if (!group.source_document) return false
    return fileRefsMatch(fileRef, getMetadataGroupRef(group))
  })

  if (matchingGroups.length === 0) return undefined

  const bestGroup = matchingGroups.reduce((best, current) => {
    const bestRef = sanitizeFileRef(getMetadataGroupRef(best))
    const currentRef = sanitizeFileRef(getMetadataGroupRef(current))
    return currentRef.length > bestRef.length ? current : best
  })

  return (bestGroup.fields || []).map((field) =>
    normalizeField(field as unknown as Record<string, unknown>),
  )
}

export function resolveDocumentMetadataFields(
  node: DataTreeNodeT,
  dossierMetadata?: DataDossierMetadataT,
): Array<DataDocumentFieldT> {
  const fileRef = resolveDocumentFileRef(node)
  if (dossierMetadata?.metadata_groups?.length) {
    const matched = matchMetadataFields(
      fileRef,
      dossierMetadata.metadata_groups,
    )
    if (matched && matched.length > 0) return matched
  }
  return node.fields ?? []
}

export function resolveMetadataUrl(
  ...sources: Array<unknown>
): string | undefined {
  for (const source of sources) {
    if (!source) continue
    if (typeof source === 'string') return source
    if (typeof source === 'object') {
      const record = source as Record<string, unknown>
      if (typeof record.currentMetadataUrl === 'string') {
        return record.currentMetadataUrl
      }
      if (record.metadata && typeof record.metadata === 'object') {
        const metadata = record.metadata as Record<string, unknown>
        if (typeof metadata.currentMetadataUrl === 'string') {
          return metadata.currentMetadataUrl
        }
      }
    }
  }
  return undefined
}

function parseMetadataJsonText(text: string): unknown {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  let jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed
  try {
    return JSON.parse(jsonText)
  } catch (error) {
    try {
      jsonText = jsonText.replace(/,\s*([\]}])/g, '$1')
      return JSON.parse(jsonText)
    } catch {
      throw error
    }
  }
}

function parseMetadataResponseBody(data: unknown): unknown | null {
  if (data == null) return null
  if (typeof data === 'string') {
    try {
      return parseMetadataJsonText(data)
    } catch {
      return null
    }
  }
  return data
}

async function fetchMetadataJson(metaUrl: string): Promise<unknown | null> {
  const isApiPath =
    metaUrl.startsWith('/') ||
    Boolean(env.API_URL && metaUrl.startsWith(env.API_URL))

  try {
    if (isApiPath) {
      const path = metaUrl.startsWith('/')
        ? metaUrl
        : metaUrl.slice(env.API_URL.length)
      const response = await apiClient.get<unknown>(path)
      return parseMetadataResponseBody(response.data)
    }

    const response = await fetch(metaUrl)
    if (!response.ok) return null
    const text = await response.text()
    return parseMetadataResponseBody(text)
  } catch {
    return null
  }
}

export async function fetchMetadataGroups(
  metaUrl: string | undefined,
): Promise<Array<MetadataGroup>> {
  if (!metaUrl) return []

  try {
    const metadataJson = await fetchMetadataJson(metaUrl)
    const parsed = parseMetadataResponseBody(metadataJson) ?? metadataJson
    if (parsed && typeof parsed === 'object') {
      let groupsRaw: unknown[] = []

      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === 'object' && 'metadata_groups' in parsed[0]) {
          groupsRaw = parsed.flatMap((item: any) => 
            Array.isArray(item?.metadata_groups) ? item.metadata_groups : []
          )
        } else {
          groupsRaw = parsed
        }
      } else {
        const record = parsed as Record<string, unknown>
        groupsRaw = Array.isArray(record.metadata_groups)
          ? record.metadata_groups
          : []
      }
      
      if (groupsRaw.length > 0) {
        return groupsRaw.map((group) => normalizeMetadataGroup(group as Record<string, unknown>))
      }
    }
  } catch (error) {
    console.error('Failed to fetch metadata:', error)
  }

  return []
}

export async function fetchDossierMetadata(
  metaUrl: string | undefined,
): Promise<DataDossierMetadataT | undefined> {
  if (!metaUrl) return undefined

  try {
    const metadataJson = await fetchMetadataJson(metaUrl)
    const parsed = parseMetadataResponseBody(metadataJson) ?? metadataJson
    return parseDossierMetadata(parsed)
  } catch (error) {
    console.error('Failed to fetch dossier metadata:', error)
    return undefined
  }
}

function cloneDossierMetadata(
  metadata: DataDossierMetadataT,
): DataDossierMetadataT {
  return JSON.parse(JSON.stringify(metadata)) as DataDossierMetadataT
}

function fieldOccurrenceIndex(
  fields: Array<DataDocumentFieldT>,
  fieldIndex: number,
): number {
  const name = fields[fieldIndex]?.name
  if (!name) return 0

  let occurrence = 0
  for (let index = 0; index <= fieldIndex; index++) {
    if (fields[index].name === name) occurrence++
  }
  return occurrence - 1
}

function findFieldIndexByOccurrence(
  fields: Array<DataDocumentFieldT>,
  name: string,
  occurrence: number,
): number {
  let count = 0
  for (let index = 0; index < fields.length; index++) {
    if (fields[index].name === name) {
      if (count === occurrence) return index
      count++
    }
  }
  return -1
}

function fieldsAreMergeDuplicates(
  left: DataDocumentFieldT,
  right: DataDocumentFieldT,
): boolean {
  return (
    left.name === right.name &&
    left.display === right.display &&
    coerceMetadataText(left.value) === coerceMetadataText(right.value) &&
    left.page === right.page &&
    JSON.stringify(left.bboxes) === JSON.stringify(right.bboxes)
  )
}

/** Remove adjacent identical fields caused by bad backend merge append. */
export function dedupeMergeArtifactFields(
  fields: Array<DataDocumentFieldT>,
): Array<DataDocumentFieldT> {
  const result: Array<DataDocumentFieldT> = []
  for (const field of fields) {
    const previous = result.at(-1)
    if (previous && fieldsAreMergeDuplicates(previous, field)) continue
    result.push(field)
  }
  return result
}

export function dedupeDossierMetadataMergeArtifacts(
  metadata: DataDossierMetadataT,
): DataDossierMetadataT {
  return {
    ...metadata,
    metadata_groups: metadata.metadata_groups.map((group) => ({
      ...group,
      fields: dedupeMergeArtifactFields(group.fields),
    })),
  }
}

/** Patch edited field values into the full metadata snapshot without adding rows. */
export function mergeMetadataFieldChanges(
  base: DataDossierMetadataT,
  edited: DataDossierMetadataT,
): DataDossierMetadataT {
  const result = cloneDossierMetadata(base)

  if (edited.ho_so_id !== undefined) result.ho_so_id = edited.ho_so_id
  if (edited.trang_thai_ho_so !== undefined) {
    result.trang_thai_ho_so = edited.trang_thai_ho_so
  }
  if (edited.general_fields) result.general_fields = edited.general_fields

  const baseGroupByKey = new Map(
    result.metadata_groups.map((group, index) => [
      groupMergeKey(group, index),
      index,
    ]),
  )

  for (const [editedIndex, editedGroup] of edited.metadata_groups.entries()) {
    const baseGroupIndex = baseGroupByKey.get(
      groupMergeKey(editedGroup, editedIndex),
    )
    if (baseGroupIndex == null) continue

    const baseGroup = result.metadata_groups[baseGroupIndex]
    const nextFields = [...baseGroup.fields]

    editedGroup.fields.forEach((editedField, editedFieldIndex) => {
      const occurrence = fieldOccurrenceIndex(
        editedGroup.fields,
        editedFieldIndex,
      )
      const baseFieldIndex = findFieldIndexByOccurrence(
        nextFields,
        editedField.name,
        occurrence,
      )
      if (baseFieldIndex < 0) return

      nextFields[baseFieldIndex] = {
        ...nextFields[baseFieldIndex],
        value: coerceMetadataText(editedField.value),
        ...(editedField.display.trim() ? { display: editedField.display } : {}),
      }
    })

    result.metadata_groups[baseGroupIndex] = {
      ...baseGroup,
      source_document: editedGroup.source_document,
      fields: dedupeMergeArtifactFields(nextFields),
    }
  }

  return dedupeDossierMetadataMergeArtifacts(result)
}

function resolveAllowedFieldsFromDossierMeta(
  dossierMeta?: Record<string, unknown>,
): Array<string> | undefined {
  if (!Array.isArray(dossierMeta?.allowedFields)) return undefined
  return dossierMeta.allowedFields as Array<string>
}

/** Backend sends inline `currentMetadata` already filtered when field ACL is active. */
function isBackendPrefilteredInlineMetadata(
  dossierMeta?: Record<string, unknown>,
): boolean {
  if (
    dossierMeta?.currentMetadata == null ||
    dossierMeta?.currentMetadataUrl != null ||
    !resolveAllowedFieldsFromDossierMeta(dossierMeta)?.length
  ) {
    return false
  }

  const inline = dossierMeta.currentMetadata
  const parsed =
    parseDossierMetadata(inline) ??
    (inline as DataDossierMetadataT | undefined)
  return (parsed?.metadata_groups?.length ?? 0) > 0
}

/** Keep only fields listed in `allowedFields` (e.g. `GROUP_CODE.FIELD_NAME`). */
function isMetadataFieldAllowedForGroup(
  group: DataMetadataGroupT,
  fieldName: string,
  allowedFields: Array<string>,
): boolean {
  const catalogGroupCode = resolveMetadataGroupCatalogCode(group)
  for (const code of resolveCatalogGroupAliasCodes(catalogGroupCode)) {
    if (isFieldAllowed(`${code}.${fieldName}`, allowedFields)) {
      return true
    }
  }
  if (
    group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE &&
    catalogGroupCode !== TAI_LIEU_LUU_TRU_GROUP_CODE
  ) {
    for (const code of resolveCatalogGroupAliasCodes(TAI_LIEU_LUU_TRU_GROUP_CODE)) {
      if (isFieldAllowed(`${code}.${fieldName}`, allowedFields)) {
        return true
      }
    }
  }
  return false
}

function groupCodeMatchesAllowedPatterns(
  groupCode: string,
  allowedFields: Array<string>,
): boolean {
  for (const code of resolveCatalogGroupAliasCodes(groupCode)) {
    if (allowedFields.includes(`${code}.*`)) return true
    if (allowedFields.some((key) => key.startsWith(`${code}.`))) return true
  }
  return false
}

function isTaiLieuDocumentGroupAllowed(
  catalogGroupCode: string,
  allowedFields: Array<string>,
): boolean {
  if (groupCodeMatchesAllowedPatterns(catalogGroupCode, allowedFields)) {
    return true
  }
  return groupCodeMatchesAllowedPatterns(
    TAI_LIEU_LUU_TRU_GROUP_CODE,
    allowedFields,
  )
}

export function filterDossierMetadataByAllowedFields(
  metadata: DataDossierMetadataT,
  allowedFields?: Array<string> | null,
): DataDossierMetadataT {
  if (!allowedFields?.length) return metadata

  const normalized = expandTaiLieuDocuments(metadata)
  const metadata_groups: Array<DataMetadataGroupT> = []

  for (const group of normalized.metadata_groups) {
    const catalogGroupCode = resolveMetadataGroupCatalogCode(group)

    if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
      if (!isTaiLieuDocumentGroupAllowed(catalogGroupCode, allowedFields)) {
        continue
      }
    } else if (!groupCodeMatchesAllowedPatterns(group.group_code, allowedFields)) {
      continue
    }

    const fields = group.fields.filter((field) =>
      isMetadataFieldAllowedForGroup(group, field.name, allowedFields),
    )

    if (group.group_code === HO_SO_LUU_TRU_GROUP_CODE) {
      const fondField = group.fields.find(
        (field) => field.name.trim().toUpperCase() === HO_SO_FOND_FIELD,
      )
      if (
        fondField &&
        fields.length > 0 &&
        !fields.some(
          (field) => field.name.trim().toUpperCase() === HO_SO_FOND_FIELD,
        )
      ) {
        fields.unshift(fondField)
      }
    }

    if (group.group_code === TAI_LIEU_LUU_TRU_GROUP_CODE) {
      const typeField = group.fields.find(
        (field) =>
          field.name.trim().toUpperCase() === TEN_LOAI_TAI_LIEU_FIELD,
      )
      if (
        typeField &&
        fields.length > 0 &&
        !fields.some(
          (field) =>
            field.name.trim().toUpperCase() === TEN_LOAI_TAI_LIEU_FIELD,
        )
      ) {
        fields.unshift(typeField)
      }
    }

    if (fields.length > 0) {
      metadata_groups.push({ ...group, fields })
    }
  }

  return { ...normalized, metadata_groups }
}

function extractFondIdFromDossierMeta(
  dossierMeta?: Record<string, unknown>,
): string | undefined {
  const raw = dossierMeta?.fondId ?? dossierMeta?.fond_id
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed || undefined
}

function applyDossierFondContext(
  metadata: DataDossierMetadataT | undefined,
  dossierMeta?: Record<string, unknown>,
): DataDossierMetadataT | undefined {
  if (!metadata) return undefined
  return ensureHoSoFondField(
    metadata,
    extractFondIdFromDossierMeta(dossierMeta),
  )
}

function resolveInlineDossierMetadata(dossierMeta?: Record<string, unknown>): {
  dossierMetadata: DataDossierMetadataT
  fullDossierMetadata: DataDossierMetadataT
  metadataGroups: Array<MetadataGroup>
} | null {
  const inline = dossierMeta?.currentMetadata
  if (!inline) return null

  const parsed =
    parseDossierMetadata(inline) ?? (inline as DataDossierMetadataT)
  const fullDossierMetadata = applyDossierFondContext(
    dedupeDossierMetadataMergeArtifacts(parsed),
    dossierMeta,
  )
  if (!fullDossierMetadata) return null

  const allowedFields = resolveAllowedFieldsFromDossierMeta(dossierMeta)
  const dossierMetadata = isBackendPrefilteredInlineMetadata(dossierMeta)
    ? fullDossierMetadata
    : filterDossierMetadataByAllowedFields(
        fullDossierMetadata,
        allowedFields,
      )

  return {
    dossierMetadata,
    fullDossierMetadata,
    metadataGroups: fullDossierMetadata.metadata_groups,
  }
}

async function resolveFetchedDossierMetadata(
  metaUrl: string | undefined,
  dossierMeta?: Record<string, unknown>,
): Promise<{
  dossierMetadata?: DataDossierMetadataT
  fullDossierMetadata?: DataDossierMetadataT
  metadataGroups: Array<MetadataGroup>
}> {
  const [metadataGroups, fetchedMetadata] = await Promise.all([
    fetchMetadataGroups(metaUrl),
    fetchDossierMetadata(metaUrl),
  ])
  if (!fetchedMetadata) {
    return {
      metadataGroups,
      dossierMetadata: undefined,
      fullDossierMetadata: undefined,
    }
  }

  const fullDossierMetadata = applyDossierFondContext(
    dedupeDossierMetadataMergeArtifacts(fetchedMetadata),
    dossierMeta,
  )
  if (!fullDossierMetadata) {
    return {
      metadataGroups,
      dossierMetadata: undefined,
      fullDossierMetadata: undefined,
    }
  }

  const allowedFields = resolveAllowedFieldsFromDossierMeta(dossierMeta)
  const dossierMetadata = filterDossierMetadataByAllowedFields(
    fullDossierMetadata,
    allowedFields,
  )

  return {
    dossierMetadata,
    fullDossierMetadata,
    metadataGroups: fullDossierMetadata.metadata_groups.length
      ? fullDossierMetadata.metadata_groups
      : metadataGroups,
  }
}

/** Resolve metadata from claim — URL fetch OR inline payload (mutually exclusive). */
export async function resolveClaimMetadata(
  claim: Pick<
    MakerClaimT,
    'currentMetadataUrl' | 'currentMetadata' | 'allowedFields'
  >,
): Promise<{
  dossierMetadata?: DataDossierMetadataT
  fullDossierMetadata?: DataDossierMetadataT
  metadataGroups: Array<MetadataGroup>
}> {
  if (claim.currentMetadataUrl) {
    return resolveFetchedDossierMetadata(claim.currentMetadataUrl, {
      allowedFields: claim.allowedFields,
    })
  }

  if (claim.currentMetadata) {
    const parsed =
      parseDossierMetadata(claim.currentMetadata) ?? claim.currentMetadata
    const parsedMetadata = applyDossierFondContext(
      dedupeDossierMetadataMergeArtifacts(parsed),
    )
    if (!parsedMetadata) {
      return { metadataGroups: [] }
    }
    const hasVisibleGroups = (parsedMetadata.metadata_groups?.length ?? 0) > 0
    const isPreFiltered =
      !claim.currentMetadataUrl &&
      Array.isArray(claim.allowedFields) &&
      claim.allowedFields.length > 0 &&
      hasVisibleGroups
    const dossierMetadata = isPreFiltered
      ? parsedMetadata
      : filterDossierMetadataByAllowedFields(
          parsedMetadata,
          claim.allowedFields,
        )
    return {
      dossierMetadata,
      fullDossierMetadata: isPreFiltered ? undefined : parsedMetadata,
      metadataGroups: parsedMetadata.metadata_groups,
    }
  }

  return { metadataGroups: [] }
}

function resolveOptionalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed !== '' ? trimmed : undefined
}

/** Resolve OCR/searchable PDF URL from dossier file API payload. */
export function resolveOcrPdfUrlFromFile(
  file: Record<string, unknown>,
): string | undefined {
  return (
    resolveOptionalUrl(file.ocrPdfUrl) ??
    resolveOptionalUrl(file.ocr_pdf_url) ??
    resolveOptionalUrl(file.searchablePdfUrl) ??
    resolveOptionalUrl(file.searchable_pdf_url) ??
    resolveOptionalUrl(file.layerPdfUrl) ??
    resolveOptionalUrl(file.layer_pdf_url) ??
    resolveOptionalUrl(file.ocrFileUrl) ??
    resolveOptionalUrl(file.ocr_file_url)
  )
}

/** Resolve searchable/OCR PDF URL mapped on a document node. */
export function resolveDocumentOcrPdfUrl(
  node: DataTreeNodeT,
): string | undefined {
  return node.ocrPdfUrl?.trim() || undefined
}

export function hasSearchablePdf(node: DataTreeNodeT): boolean {
  return Boolean(resolveDocumentOcrPdfUrl(node))
}

export function mapFileToDocumentNode(
  file: Record<string, unknown>,
  parentId: string,
  metadataGroups: Array<MetadataGroup>,
): DataTreeNodeT {
  const filePath = String(
    file.fullPath || file.filePath || file.fileName || file.name || '',
  )
  const fileRef = filePath || String(file.fileUrl || '')
  const fileFields = matchMetadataFields(fileRef, metadataGroups)
  const fileUrl = resolveOptionalUrl(file.fileUrl)
  const ocrPdfUrl = resolveOcrPdfUrlFromFile(file)

  return {
    id: String(file.id),
    name: String(file.fileName || file.name),
    type: 'document',
    parentId,
    children: [],
    sizeBytes: sizeKbToBytes(file.fileSizeKb ?? file.file_size_kb),
    uploadedAt: String(
      file.createdAt || file.updatedAt || new Date().toISOString(),
    ),
    uploadedBy: 'System',
    ...(filePath ? { filePath } : {}),
    ...(fileUrl ? { fileUrl } : {}),
    ...(ocrPdfUrl ? { ocrPdfUrl } : {}),
    ...(fileFields ? { fields: fileFields } : {}),
  }
}

export interface DossierRecordContent {
  children: Array<DataTreeNodeT>
  dossierMetadata?: DataDossierMetadataT
  fullDossierMetadata?: DataDossierMetadataT
}

export type BuildDossierRecordContentOptions = {
  /** When `draft`, loads editor draft files/metadata snapshot. */
  filesStatus?: 'draft'
}

export async function buildDossierRecordContent(
  dossierId: string,
  dossierMeta?: Record<string, unknown>,
  options?: BuildDossierRecordContentOptions,
): Promise<DossierRecordContent> {
  try {
    const filesRes = await apiClient.get<DossierFilesResponseT>(
      `/api/v1/folders/dossiers/${dossierId}/files`,
      options?.filesStatus
        ? { params: { status: options.filesStatus } }
        : undefined,
    )
    const filesData = filesRes.data
    const inlineMetadata = resolveInlineDossierMetadata(dossierMeta)
    const metaUrl = inlineMetadata
      ? undefined
      : resolveMetadataUrl(
          filesData.currentMetadataUrl,
          dossierMeta,
          dossierMeta?.metadata,
        )
    const { metadataGroups, dossierMetadata, fullDossierMetadata } =
      inlineMetadata
        ? inlineMetadata
        : await resolveFetchedDossierMetadata(metaUrl, dossierMeta)
    const children = filesData.children ?? []

    return {
      children: children.map((child) =>
        mapFileToDocumentNode(
          child as unknown as Record<string, unknown>,
          dossierId,
          metadataGroups,
        ),
      ),
      dossierMetadata: applyDossierFondContext(dossierMetadata, dossierMeta),
      fullDossierMetadata: applyDossierFondContext(
        fullDossierMetadata ?? dossierMetadata,
        dossierMeta,
      ),
    }
  } catch (error) {
    console.error(`Failed to fetch files for dossier ${dossierId}:`, error)

    const fallbackFiles = Array.isArray(dossierMeta?.files)
      ? dossierMeta.files
      : []
    const inlineMetadata = resolveInlineDossierMetadata(dossierMeta)
    const metaUrl = inlineMetadata
      ? undefined
      : resolveMetadataUrl(dossierMeta, dossierMeta?.metadata)
    const { metadataGroups, dossierMetadata, fullDossierMetadata } =
      inlineMetadata
        ? inlineMetadata
        : await resolveFetchedDossierMetadata(metaUrl, dossierMeta)

    return {
      children: fallbackFiles.map((file) =>
        mapFileToDocumentNode(
          file as Record<string, unknown>,
          dossierId,
          metadataGroups,
        ),
      ),
      dossierMetadata: applyDossierFondContext(dossierMetadata, dossierMeta),
      fullDossierMetadata: applyDossierFondContext(
        fullDossierMetadata ?? dossierMetadata,
        dossierMeta,
      ),
    }
  }
}

export function resolveDocumentFileRef(node: DataTreeNodeT): string {
  return String(node.filePath || node.fileUrl || node.name || '')
}

/** True when the document is a PDF (has viewer + editor "complete" step). */
export function isPdfDocumentRef(
  fileRef: string,
  fallbackName?: string,
): boolean {
  const ref =
    (fileRef || fallbackName || '').toLowerCase().split('?')[0]?.trim() ?? ''
  return /\.pdf(f)?$/i.test(ref)
}

export function mergeFormValuesIntoFields(
  fields: Array<DataDocumentFieldT>,
  values: Record<string, string>,
): Array<DataDocumentFieldT> {
  return fields.map((field) => {
    const rawValue =
      values[field.name] !== undefined
        ? values[field.name]
        : coerceMetadataText(field.value)
    const value = resolveMetadataValueForSave(rawValue, field.value, field.type)
    return { ...field, value }
  })
}

function groupMatchesFileRef(
  group: DataMetadataGroupT,
  fileRef: string,
): boolean {
  if (!group.source_document) return false
  return fileRefsMatch(fileRef, getMetadataGroupRef(group))
}

export function applyDocumentFieldsToDossierMetadata(
  metadata: DataDossierMetadataT,
  fileRef: string,
  updatedFields: Array<DataDocumentFieldT>,
): DataDossierMetadataT {
  const matchingEntries = metadata.metadata_groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => groupMatchesFileRef(group, fileRef))

  if (matchingEntries.length === 0) {
    return {
      ...metadata,
      metadata_groups: [
        ...metadata.metadata_groups,
        {
          group_code: `DOC_${Date.now()}`,
          group_name: fileRef.split('/').pop() ?? fileRef,
          source_document: {
            file_name: fileRef.split('/').pop() ?? fileRef,
            file_path: fileRef,
          },
          fields: updatedFields,
        },
      ],
    }
  }

  const bestEntry = matchingEntries.reduce((best, current) => {
    const bestRef = sanitizeFileRef(getMetadataGroupRef(best.group))
    const currentRef = sanitizeFileRef(getMetadataGroupRef(current.group))
    return currentRef.length > bestRef.length ? current : best
  })

  const metadataGroups = metadata.metadata_groups.map((group, index) =>
    index === bestEntry.index ? { ...group, fields: updatedFields } : group,
  )

  return { ...metadata, metadata_groups: metadataGroups }
}

export function isFieldCaretAtEnd(
  element: HTMLInputElement | HTMLTextAreaElement,
): boolean {
  const { selectionStart, selectionEnd, value } = element
  if (selectionStart == null || selectionEnd == null) return true
  return selectionStart === value.length && selectionEnd === value.length
}

export function isFieldCaretAtStart(
  element: HTMLInputElement | HTMLTextAreaElement,
): boolean {
  const { selectionStart, selectionEnd } = element
  if (selectionStart == null || selectionEnd == null) return true
  return selectionStart === 0 && selectionEnd === 0
}

export interface MetadataFieldNavigationHandlers {
  focusNext: () => void
  focusPrevious: () => void
}

export interface MetadataFieldNavigationOptions {
  isTextArea?: boolean
  alwaysNavigateOnEnter?: boolean
}

export function handleMetadataFieldNavigationKeyDown(
  event: KeyboardEvent<HTMLElement>,
  handlers: MetadataFieldNavigationHandlers,
  options?: MetadataFieldNavigationOptions,
): void {
  const target = event.currentTarget
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    )
  ) {
    return
  }

  const { isTextArea = false, alwaysNavigateOnEnter = false } = options ?? {}

  if (event.key === 'Tab' && event.shiftKey) {
    event.preventDefault()
    handlers.focusPrevious()
    return
  }

  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
    handlers.focusNext()
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    if (!alwaysNavigateOnEnter && isTextArea) return
    event.preventDefault()
    handlers.focusNext()
    return
  }

  if (event.key === 'Enter' && event.shiftKey && isTextArea) {
    event.preventDefault()
    handlers.focusNext()
    return
  }

  if (event.key === 'ArrowDown') {
    if (!isFieldCaretAtEnd(target)) return
    event.preventDefault()
    handlers.focusNext()
    return
  }

  if (event.key === 'ArrowUp') {
    if (!isFieldCaretAtStart(target)) return
    event.preventDefault()
    handlers.focusPrevious()
  }
}

/** Reject field key sent to checker reject API: `GROUP_CODE.FIELD_NAME`. */
export function buildRejectFieldKey(
  groupCode: string,
  fieldName: string,
): string {
  return `${groupCode}.${fieldName}`
}

export interface RejectFieldOptionT {
  key: string
  label: string
  groupLabel: string
  currentValue: string
}

export function collectRejectFieldOptions(
  metadata: DataDossierMetadataT | null | undefined,
): Array<RejectFieldOptionT> {
  if (!metadata?.metadata_groups?.length) return []

  const options: Array<RejectFieldOptionT> = []
  for (const group of metadata.metadata_groups) {
    const groupLabel = getMetadataGroupDisplayName(group)
    for (const field of getVisibleMetadataFields(group.fields)) {
      options.push({
        key: buildRejectFieldKey(group.group_code, field.name),
        label: field.display.trim() || field.name,
        groupLabel,
        currentValue: coerceMetadataText(field.value),
      })
    }
  }
  return options
}

/** Resolve metadata group_code for a document file ref. */
export function resolveGroupCodeForDocument(
  metadata: DataDossierMetadataT,
  fileRef: string,
  fieldNames: Array<string> = [],
): string | undefined {
  const matchingEntries = metadata.metadata_groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => groupMatchesFileRef(group, fileRef))

  if (matchingEntries.length > 0) {
    const bestEntry = matchingEntries.reduce((best, current) => {
      const bestRef = sanitizeFileRef(getMetadataGroupRef(best.group))
      const currentRef = sanitizeFileRef(getMetadataGroupRef(current.group))
      return currentRef.length > bestRef.length ? current : best
    })
    return bestEntry.group.group_code
  }

  if (fieldNames.length > 0) {
    for (const group of metadata.metadata_groups) {
      if (
        fieldNames.some((name) =>
          group.fields.some((field) => field.name === name),
        )
      ) {
        return group.group_code
      }
    }
  }

  return metadata.metadata_groups[0]?.group_code
}

export function buildDefaultDossierMetadata(
  fileRef: string,
  fields: Array<DataDocumentFieldT>,
): DataDossierMetadataT {
  return {
    metadata_groups: [
      {
        group_code: `DOC_${Date.now()}`,
        group_name: fileRef.split('/').pop() ?? fileRef,
        source_document: {
          file_name: fileRef.split('/').pop() ?? fileRef,
          file_path: fileRef,
        },
        fields,
      },
    ],
  }
}
