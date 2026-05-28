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

export interface MetadataGroup {
  group_code?: string
  group_name?: string
  source_document?: {
    file_path?: string
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

  const parsedPage = Number(field.page)
  const page = Number.isFinite(parsedPage) ? parsedPage : 1

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
            (group.source_document as Record<string, unknown>).file_path ?? '',
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

export function fileRefsMatch(fileRef: string, groupRef: string): boolean {
  const cleanChild = sanitizeFileRef(fileRef)
  const cleanGroup = sanitizeFileRef(groupRef)
  if (!cleanChild || !cleanGroup) return false
  if (cleanChild.includes(cleanGroup) || cleanGroup.includes(cleanChild)) {
    return true
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
    const groupRef =
      group.source_document.file_path || group.source_document.file_name || ''
    return fileRefsMatch(fileRef, groupRef)
  })

  if (matchingGroups.length === 0) return undefined
  return matchingGroups.flatMap((group) =>
    (group.fields || []).map((field) =>
      normalizeField(field as unknown as Record<string, unknown>),
    ),
  )
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
  const fileRef = String(
    file.fullPath ||
      file.filePath ||
      file.fileUrl ||
      file.fileName ||
      file.name ||
      '',
  )
  const fileFields = matchMetadataFields(fileRef, metadataGroups)

  return {
    id: String(file.id),
    name: String(file.fileName || file.name),
    type: 'document',
    parentId,
    children: [],
    sizeBytes: (Number(file.fileSizeKb) || 0) * 1024,
    uploadedAt: String(
      file.createdAt || file.updatedAt || new Date().toISOString(),
    ),
    uploadedBy: 'System',
    fileUrl: String(file.fileUrl || file.fullPath || file.filePath || ''),
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
  return String(node.fileUrl || node.name || '')
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
  const groupRef =
    group.source_document.file_path || group.source_document.file_name || ''
  return fileRefsMatch(fileRef, groupRef)
}

export function applyDocumentFieldsToDossierMetadata(
  metadata: DataDossierMetadataT,
  fileRef: string,
  updatedFields: Array<DataDocumentFieldT>,
): DataDossierMetadataT {
  let hasMatchingGroup = false

  const metadataGroups = metadata.metadata_groups.map((group) => {
    if (!groupMatchesFileRef(group, fileRef)) return group

    hasMatchingGroup = true
    return { ...group, fields: updatedFields }
  })

  if (!hasMatchingGroup) {
    metadataGroups.push({
      group_code: `DOC_${Date.now()}`,
      group_name: fileRef.split('/').pop() ?? fileRef,
      source_document: {
        file_name: fileRef.split('/').pop() ?? fileRef,
        file_path: fileRef,
      },
      fields: updatedFields,
    })
  }

  return { ...metadata, metadata_groups: metadataGroups }
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
