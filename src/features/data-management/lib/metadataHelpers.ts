import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'
import type {
  DataDocumentFieldT,
  DataDossierMetadataT,
  DataMetadataGroupT,
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
    rawType === 'date' || rawType === 'number' ? rawType : 'string'

  return {
    name: String(field.name ?? ''),
    display: String(field.display ?? field.name ?? ''),
    type: fieldType,
    value: field.value != null ? String(field.value) : '',
    page: Number(field.page) || 1,
    bbox: Array.isArray(field.bbox)
      ? field.bbox.map((value) => Number(value))
      : [],
  }
}

function normalizeMetadataGroup(group: Record<string, unknown>): DataMetadataGroupT {
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

export function parseDossierMetadata(json: unknown): DataDossierMetadataT | undefined {
  if (!json || typeof json !== 'object') return undefined

  const record = json as Record<string, unknown>
  const groups = Array.isArray(record.metadata_groups)
    ? record.metadata_groups.map((group) =>
        normalizeMetadataGroup(group as Record<string, unknown>),
      )
    : []

  if (
    groups.length === 0 &&
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
    metadata_groups: groups,
  }
}

export function sanitizeFileRef(str: string): string {
  return (str || '').replace(/\.pdff?$/i, '').trim()
}

export function matchMetadataFields(
  fileRef: string,
  metadataGroups: Array<MetadataGroup>,
): Array<DataDocumentFieldT> | undefined {
  if (metadataGroups.length === 0) return undefined

  const cleanChild = sanitizeFileRef(fileRef)
  const matchingGroups = metadataGroups.filter((group) => {
    if (!group.source_document) return false
    const groupRef =
      group.source_document.file_path || group.source_document.file_name || ''
    const cleanGroup = sanitizeFileRef(groupRef)
    return (
      cleanChild &&
      cleanGroup &&
      (cleanChild.includes(cleanGroup) || cleanGroup.includes(cleanChild))
    )
  })

  if (matchingGroups.length === 0) return undefined
  return matchingGroups.flatMap((group) => group.fields || [])
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

async function fetchMetadataJson(
  metaUrl: string,
): Promise<unknown | null> {
  const isApiPath =
    metaUrl.startsWith('/') ||
    Boolean(env.API_URL && metaUrl.startsWith(env.API_URL))

  if (isApiPath) {
    const path = metaUrl.startsWith('/')
      ? metaUrl
      : metaUrl.slice(env.API_URL.length)
    const response = await apiClient.get<unknown>(path)
    return response.data
  }

  const response = await fetch(metaUrl)
  if (!response.ok) return null
  return response.json()
}

export async function fetchMetadataGroups(
  metaUrl: string | undefined,
): Promise<Array<MetadataGroup>> {
  if (!metaUrl) return []

  try {
    const metadataJson = await fetchMetadataJson(metaUrl)
    if (
      metadataJson &&
      typeof metadataJson === 'object' &&
      Array.isArray((metadataJson as { metadata_groups?: unknown }).metadata_groups)
    ) {
      return (metadataJson as { metadata_groups: Array<MetadataGroup> })
        .metadata_groups
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
    return parseDossierMetadata(metadataJson)
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
    file.fullPath || file.filePath || file.fileUrl || file.fileName || file.name || '',
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

/** @deprecated Use buildDossierRecordContent */
export async function buildDocumentNodesFromDossier(
  dossierId: string,
  dossierMeta?: Record<string, unknown>,
): Promise<Array<DataTreeNodeT>> {
  const result = await buildDossierRecordContent(dossierId, dossierMeta)
  return result.children
}
