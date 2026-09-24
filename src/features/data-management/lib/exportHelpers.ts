import { fetchDossierIdByFolderId } from '@/features/data-management/api/dataManagementClient'
import {
  exportDossierDip,
  exportDossierMetadataExcel,
  exportFolderMetadataExcel,
  exportMultiDossiersMetadataExcel,
  exportMultiFoldersMetadataExcel,
  exportMultiDossiersDip,
  exportFolderDip,
  type MetadataExportRequestT,
} from '@/features/data-management/api/dossierClient'
import { canExportDossierMetadata } from '@/features/data-management/lib/dossierStatusHelpers'
import {
  findDescendantDossierTarget,
  isDossierWorkflowNode,
  resolveFolderExportId,
  resolveRecordDossierId,
} from '@/features/data-management/lib/treeUtils'
import type {
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'

export type ExportKind = 'folder' | 'dossier' | 'multi_dossiers'
export type ExportMode = 'metadata' | 'dip' | 'excel' | 'tiff' | 'pdf'

export interface ExportOptions {
  presetId?: string
  useDocumentNaming?: boolean
}

export interface ExportContext {
  kind: ExportKind
  folderId: string | null
  /** Batch: one or more folder subtrees (no cascade-load on FE). */
  folderIds?: string[]
  dossierId: string | null
  dossierIds?: string[]
  downloadName: string
}

function resolveExportableDossierStatus(
  node: DataTreeNodeT,
): DataDossierStatus | undefined {
  if (node.dossierStatus) return node.dossierStatus

  if (node.type === 'folder') {
    for (const child of node.children) {
      if (isDossierWorkflowNode(child) && child.dossierStatus) {
        return child.dossierStatus
      }
      if (child.type === 'record' && child.dossierStatus) {
        return child.dossierStatus
      }
      const nested = resolveExportableDossierStatus(child)
      if (nested) return nested
    }
  }

  return undefined
}

/** Export is only available after final approval (admin + QC), unless bypassStatus. */
export function canExportNode(
  node: DataTreeNodeT,
  options?: { bypassStatus?: boolean },
): boolean {
  if (node.type === 'document') return false

  if (options?.bypassStatus) {
    return node.type === 'record' || node.type === 'folder'
  }

  if (node.type === 'record') {
    return canExportDossierMetadata(node.dossierStatus)
  }

  if (node.type === 'folder') {
    return canExportDossierMetadata(resolveExportableDossierStatus(node))
  }

  return false
}

export function resolveExportContext(
  node: DataTreeNodeT,
  options?: { bypassStatus?: boolean },
): ExportContext | null {
  if (!canExportNode(node, options)) return null

  if (node.type === 'folder') {
    const folderId = resolveFolderExportId(node)
    const descendant = findDescendantDossierTarget(node)
    return {
      kind: 'folder',
      folderId,
      dossierId: descendant?.dossierId ?? null,
      downloadName: node.name,
    }
  }

  if (node.type === 'record') {
    const dossierId = resolveRecordDossierId(node)
    return {
      kind: 'dossier',
      folderId: null,
      dossierId,
      downloadName: node.dossierMetadata?.ho_so_id?.trim() || node.name,
    }
  }

  return null
}

export async function resolveDossierIdForDip(
  context: ExportContext,
): Promise<string | null> {
  if (context.dossierId) return context.dossierId

  if (context.kind === 'folder' && context.folderId) {
    return fetchDossierIdByFolderId(context.folderId)
  }

  return null
}

export interface RunExportParams {
  kind: ExportKind
  mode: ExportMode
  folderId: string | null
  folderIds?: string[]
  dossierId: string | null
  dossierIds?: string[]
  downloadName: string
  metadataExportConfig?: MetadataExportRequestT
  useDocumentNaming?: boolean
}

export async function runExport({
  kind,
  mode,
  folderId,
  folderIds,
  dossierId,
  dossierIds,
  downloadName,
  metadataExportConfig,
  useDocumentNaming,
}: RunExportParams): Promise<void> {
  const namingFlag = useDocumentNaming === true
    ? { useDocumentNaming: true as const }
    : undefined
  const metadataConfig =
    metadataExportConfig || namingFlag
      ? { ...metadataExportConfig, ...namingFlag }
      : undefined

  const batchFolderIds = [
    ...new Set(
      (folderIds?.length ? folderIds : folderId ? [folderId] : []).filter(
        Boolean,
      ) as string[],
    ),
  ]
  const batchDossierIds = [...new Set((dossierIds ?? []).filter(Boolean))]

  if (mode === 'metadata' || mode === 'excel' || mode === 'tiff' || mode === 'pdf') {
    const configWithFlags: MetadataExportRequestT | undefined =
      mode === 'excel'
        ? { ...metadataConfig, excelOnly: true }
        : mode === 'tiff'
          ? { ...metadataConfig, tiffOnly: true }
          : mode === 'pdf'
            ? { ...metadataConfig, pdfOnly: true }
            : metadataConfig
    if (kind === 'multi_dossiers') {
      if (batchFolderIds.length > 0) {
        await exportMultiFoldersMetadataExcel(
          batchFolderIds,
          downloadName,
          configWithFlags,
        )
      }
      if (batchDossierIds.length > 0) {
        await exportMultiDossiersMetadataExcel(
          batchDossierIds,
          downloadName,
          configWithFlags,
        )
      }
      if (batchFolderIds.length === 0 && batchDossierIds.length === 0) {
        throw new Error('Missing required IDs for metadata export')
      }
      return
    }
    if (kind === 'folder' && folderId) {
      await exportFolderMetadataExcel(
        folderId,
        downloadName,
        configWithFlags,
      )
      return
    }
    if (kind === 'dossier' && dossierId) {
      await exportDossierMetadataExcel(
        dossierId,
        downloadName,
        configWithFlags,
      )
      return
    }
    throw new Error('Missing required IDs for metadata export')
  }

  if (mode === 'dip') {
    if (kind === 'multi_dossiers') {
      if (batchFolderIds.length > 0 || batchDossierIds.length > 0) {
        await exportMultiDossiersDip(
          batchDossierIds,
          downloadName,
          batchFolderIds[0],
          namingFlag,
          batchFolderIds,
        )
        return
      }
      throw new Error('Missing required IDs for DIP export')
    }
    if (kind === 'folder' && folderId) {
      await exportFolderDip(folderId, downloadName, namingFlag)
      return
    }
    if (!dossierId) {
      throw new Error('DIP export requires dossierId')
    }
    await exportDossierDip(dossierId, downloadName, namingFlag)
    return
  }

  throw new Error(`Unknown export mode: ${mode}`)
}
