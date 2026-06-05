import { apiClient } from '@/lib/api/apiClient'
import {
  coerceMetadataText,
  metadataDateFromInputValue,
} from '@/features/data-management/lib/metadataDate'
import { env } from '@/lib/utils/env'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataMetadataGroupT,
  DataRecordInfoFieldT,
  DataTreeNodeT,
} from '@/features/data-management/types'

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

function normalizeField(field: Record<string, unknown>): DataDocumentFieldT {
  const rawType = String(field.type ?? 'string')
  const fieldType: DataDocumentFieldT['type'] =
    rawType === 'date' || rawType === 'number' || rawType === 'boolean'
      ? rawType
      : 'string'

  const rawPage = field.page
  const page =
    rawPage === null || rawPage === undefined
      ? 0
      : Number.isFinite(Number(rawPage))
        ? Number(rawPage)
        : 0

  return {
    name: String(field.name ?? ''),
    display: String(field.display ?? field.name ?? ''),
    type: fieldType,
    value: coerceMetadataText(field.value),
    page,
    bbox: Array.isArray(field.bbox)
      ? field.bbox.map((value) => Number(value))
      : [],
  }
}

const DRAFT_CUSTOM_FIELD_PREFIX = 'custom_field_'

export function createDraftCustomField(index: number): DataDocumentFieldT {
  return {
    name: `${DRAFT_CUSTOM_FIELD_PREFIX}${Date.now()}_${index}`,
    display: '',
    type: 'string',
    value: '',
    page: 0,
    bbox: [],
  }
}

export function isDraftCustomField(field: DataDocumentFieldT): boolean {
  return (
    field.page === 0 &&
    field.bbox.length === 0 &&
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

  const record = json as Record<string, unknown>
  const groups = Array.isArray(record.metadata_groups)
    ? record.metadata_groups.map((group) =>
        normalizeMetadataGroup(group as Record<string, unknown>),
      )
    : []
  const generalFields = parseGeneralFields(record)

  if (
    groups.length === 0 &&
    generalFields.length === 0 &&
    !record.ho_so_id &&
    !record.trang_thai_ho_so
  ) {
    return undefined
  }

  return {
    ho_so_id: record.ho_so_id != null ? String(record.ho_so_id) : undefined,
    trang_thai_ho_so:
      record.trang_thai_ho_so != null
        ? String(record.trang_thai_ho_so)
        : undefined,
    general_fields: generalFields.length > 0 ? generalFields : undefined,
    metadata_groups: groups,
  }
}

export function sanitizeFileRef(str: string): string {
  return (str || '').replace(/\.pdf(f)?$/i, '').trim()
}

function getFileBasename(ref: string): string {
  const sanitized = sanitizeFileRef(ref)
  const segments = sanitized.split(/[/\\]/).filter(Boolean)
  return segments.at(-1) ?? sanitized
}

function getMetadataGroupRef(group: MetadataGroup | DataMetadataGroupT): string {
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

function pickBestPathMatch<T extends { group: DataMetadataGroupT; index: number }>(
  entries: Array<T>,
): T | undefined {
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
export function getMetadataGroupDisplayName(group: DataMetadataGroupT): string {
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
    displayPath: resolveMetadataGroupSourceDocumentPath(group, dossierFolderHint),
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

export function fileRefsMatch(fileRef: string, groupRef: string): boolean {
  const cleanChild = sanitizeFileRef(fileRef)
  const cleanGroup = sanitizeFileRef(groupRef)
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
    const matched = matchMetadataFields(fileRef, dossierMetadata.metadata_groups)
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
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed
  return JSON.parse(jsonText)
}

function parseMetadataResponseBody(data: unknown): unknown | null {
  if (data == null) return null
  if (typeof data === 'string') {
    return parseMetadataJsonText(data)
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
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { metadata_groups?: unknown }).metadata_groups)
    ) {
      return (parsed as { metadata_groups: Array<Record<string, unknown>> })
        .metadata_groups.map((group) => normalizeMetadataGroup(group))
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
    ...(typeof file.fileUrl === 'string' && file.fileUrl.trim() !== ''
      ? { fileUrl: file.fileUrl.trim() }
      : {}),
    ...(fileFields ? { fields: fileFields } : {}),
  }
}

export interface DossierRecordContent {
  children: Array<DataTreeNodeT>
  dossierMetadata?: DataDossierMetadataT
}

export async function buildDossierRecordContent(
  dossierId: string,
  dossierMeta?: Record<string, unknown>,
): Promise<DossierRecordContent> {
  try {
    const filesRes = await apiClient.get<Record<string, unknown>>(
      `/api/v1/folders/dossiers/${dossierId}/files`,
    )
    const filesData = filesRes.data
    const metaUrl = resolveMetadataUrl(
      filesData.currentMetadataUrl,
      dossierMeta,
      dossierMeta?.metadata,
    )
    const [metadataGroups, dossierMetadata] = await Promise.all([
      fetchMetadataGroups(metaUrl),
      fetchDossierMetadata(metaUrl),
    ])
    const children = Array.isArray(filesData.children) ? filesData.children : []

    return {
      children: children.map((child) =>
        mapFileToDocumentNode(
          child as Record<string, unknown>,
          dossierId,
          metadataGroups,
        ),
      ),
      dossierMetadata,
    }
  } catch (error) {
    console.error(`Failed to fetch files for dossier ${dossierId}:`, error)

    const fallbackFiles = Array.isArray(dossierMeta?.files)
      ? dossierMeta.files
      : []
    const metaUrl = resolveMetadataUrl(dossierMeta, dossierMeta?.metadata)
    const [metadataGroups, dossierMetadata] = await Promise.all([
      fetchMetadataGroups(metaUrl),
      fetchDossierMetadata(metaUrl),
    ])

    return {
      children: fallbackFiles.map((file) =>
        mapFileToDocumentNode(
          file as Record<string, unknown>,
          dossierId,
          metadataGroups,
        ),
      ),
      dossierMetadata,
    }
  }
}

export function resolveDocumentFileRef(node: DataTreeNodeT): string {
  return String(node.filePath || node.fileUrl || node.name || '')
}

/** True when the document is a PDF (has viewer + editor "complete" step). */
export function isPdfDocumentRef(fileRef: string, fallbackName?: string): boolean {
  const ref = (fileRef || fallbackName || '').toLowerCase().split('?')[0]?.trim() ?? ''
  return /\.pdf(f)?$/i.test(ref)
}

export function mergeFormValuesIntoFields(
  fields: Array<DataDocumentFieldT>,
  values: Record<string, string>,
): Array<DataDocumentFieldT> {
  return fields.map((field) => {
    const rawValue = values[field.name] ?? field.value
    const value =
      field.type === 'date'
        ? metadataDateFromInputValue(
            coerceMetadataText(rawValue),
            field.value,
          )
        : coerceMetadataText(rawValue)
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
