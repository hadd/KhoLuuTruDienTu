import { fetchDossierIdByFolderId } from '@/features/data-management/api/dataManagementClient'
import {
  exportDossierDip,
  exportDossierMetadataExcel,
  exportFolderMetadataExcel,
  exportMultiDossiersMetadataExcel,
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
export type ExportMode = 'metadata' | 'dip'

export interface ExportOptions {
  presetId?: string
}

export interface ExportContext {
  kind: ExportKind
  folderId: string | null
  dossierId: string | null
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

/** Export is only available after final approval (admin + QC). */
export function canExportNode(node: DataTreeNodeT): boolean {
  if (node.type === 'document') return false

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
): ExportContext | null {
  if (!canExportNode(node)) return null

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
  dossierId: string | null
  dossierIds?: string[]
  downloadName: string
  metadataExportConfig?: MetadataExportRequestT
}

export async function runExport({
  kind,
  mode,
  folderId,
  dossierId,
  dossierIds,
  downloadName,
  metadataExportConfig,
}: RunExportParams): Promise<void> {
  if (mode === 'metadata') {
    if (kind === 'multi_dossiers' && dossierIds && dossierIds.length > 0) {
      await exportMultiDossiersMetadataExcel(dossierIds, downloadName, metadataExportConfig)
      return
    }
    if (kind === 'folder' && folderId) {
      await exportFolderMetadataExcel(folderId, downloadName, metadataExportConfig)
      return
    }
    if (kind === 'dossier' && dossierId) {
      await exportDossierMetadataExcel(dossierId, downloadName, metadataExportConfig)
      return
    }
    throw new Error('Missing required IDs for metadata export')
  }

  if (mode === 'dip') {
    if (!dossierId) {
      throw new Error('DIP export requires dossierId')
    }
    await exportDossierDip(dossierId, downloadName)
    return
  }

  throw new Error(`Unknown export mode: ${mode}`)
}
