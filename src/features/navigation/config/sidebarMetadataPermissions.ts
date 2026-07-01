import { APP_SCREEN_ACCESS } from '@/features/permissions/config/screenPermissionMap'
import {
  getModuleWildcard,
  hasFullAccess,
  isPermissionGranted,
} from '@/features/permissions/lib/permissionRules'
import type { PermissionCatalogItemT } from '@/features/permissions/types'

const METADATA_MODULE = 'metadata'

const METADATA_CHILD_SCREEN_ACCESS = {
  'document-types': APP_SCREEN_ACCESS.dataConfig.documentTypes,
  'document-assignment': APP_SCREEN_ACCESS.dataConfig.documentAssignment,
  'metadata-export-presets': APP_SCREEN_ACCESS.dataConfig.metadataExportPresets,
} as const

type MetadataChildId = keyof typeof METADATA_CHILD_SCREEN_ACCESS

const METADATA_CHILD_LABEL_PATTERNS: Record<MetadataChildId, RegExp[]> = {
  'document-types': [
    /quản lý mẫu metadata/i,
    /mẫu metadata/i,
    /metadata template/i,
    /document type/i,
    /loại tài liệu/i,
  ],
  'document-assignment': [
    /quản lý phân quyền trường metadata/i,
    /phân quyền trường metadata/i,
    /field metadata permission/i,
    /document assignment/i,
    /phân công tài liệu/i,
  ],
  'metadata-export-presets': [
    /xuất metadata/i,
    /metadata export/i,
    /export preset/i,
  ],
}

const METADATA_CHILD_KEY_PATTERNS: Record<MetadataChildId, RegExp[]> = {
  'document-types': [/template/i],
  'document-assignment': [/field.*permission|permission.*field|assignment/i],
  'metadata-export-presets': [/export.*preset|metadata.*export/i],
}

function isMetadataChildId(childId: string): childId is MetadataChildId {
  return childId in METADATA_CHILD_LABEL_PATTERNS
}

function matchesMetadataChildCatalogItem(
  childId: MetadataChildId,
  entry: PermissionCatalogItemT,
): boolean {
  if (entry.module !== METADATA_MODULE) {
    return false
  }

  const labelPatterns = METADATA_CHILD_LABEL_PATTERNS[childId]
  const keyPatterns = METADATA_CHILD_KEY_PATTERNS[childId]
  const searchableText = `${entry.label} ${entry.description ?? ''} ${entry.key}`

  return (
    labelPatterns.some((pattern) => pattern.test(searchableText)) ||
    keyPatterns.some((pattern) => pattern.test(entry.key))
  )
}

export function getMetadataSidebarCatalogItems(
  childId: string,
  catalog: Array<PermissionCatalogItemT>,
): Array<PermissionCatalogItemT> {
  if (!isMetadataChildId(childId)) {
    return []
  }

  return catalog.filter((entry) => matchesMetadataChildCatalogItem(childId, entry))
}

export function getMetadataSidebarPermissionCandidates(
  childId: string,
  catalog: Array<PermissionCatalogItemT>,
): Array<string> {
  const catalogItems = getMetadataSidebarCatalogItems(childId, catalog)
  const keys = new Set<string>()

  for (const item of catalogItems) {
    keys.add(item.key)
  }

  if (isMetadataChildId(childId)) {
    keys.add(METADATA_CHILD_SCREEN_ACCESS[childId].permissionKey)
  }

  return [...keys]
}

export function isMetadataSidebarChildGranted(
  childId: string,
  permissions: Array<string>,
  catalog: Array<PermissionCatalogItemT>,
): boolean {
  if (hasFullAccess(permissions)) {
    return true
  }

  if (permissions.includes(getModuleWildcard(METADATA_MODULE))) {
    return true
  }

  const candidateKeys = getMetadataSidebarPermissionCandidates(childId, catalog)
  if (candidateKeys.length === 0) {
    return false
  }

  return candidateKeys.some((key) =>
    isPermissionGranted(permissions, key, METADATA_MODULE),
  )
}
