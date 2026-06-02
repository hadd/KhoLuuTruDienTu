import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import {
  findAllMetadataGroupIndicesForDocument,
  findMetadataGroupIndexForDocument,
  resolveDocumentMetadataFields,
} from '@/features/data-management/lib/metadataHelpers'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type {
  DataDossierMetadataT,
  DataTreeNodeT,
} from '@/features/data-management/types'

function syncRecordDocumentFields(
  node: DataTreeNodeT,
  metadata: DataDossierMetadataT,
): DataTreeNodeT {
  return {
    ...node,
    dossierMetadata: metadata,
    children: node.children.map((child) => {
      if (child.type !== 'document') return child
      const matchedFields = resolveDocumentMetadataFields(child, metadata)
      return matchedFields.length > 0
        ? { ...child, fields: matchedFields }
        : child
    }),
  }
}

/** First document in the first record for assignment roles; root otherwise. */
export function resolveDefaultDocumentNodeId(
  tree: DataTreeNodeT,
  role: 'admin' | 'editor' | 'qc' = 'admin',
): string {
  if (role === 'editor' || role === 'qc') {
    const record = tree.children[0]
    const firstDocument = record?.children.find(
      (child) => child.type === 'document',
    )
    return firstDocument?.id ?? record?.id ?? tree.id
  }
  return tree.id
}

export function findNodeById(
  root: DataTreeNodeT,
  id: string,
): DataTreeNodeT | null {
  if (root.id === id) return root
  for (const c of root.children) {
    const found = findNodeById(c, id)
    if (found) return found
  }
  return null
}

export function getPathToNode(
  root: DataTreeNodeT,
  id: string,
): Array<DataTreeNodeT> {
  const target = findNodeById(root, id)
  if (!target) return []

  const byId = new Map<string, DataTreeNodeT>()
  function index(n: DataTreeNodeT) {
    byId.set(n.id, n)
    n.children.forEach(index)
  }
  index(root)

  const path: Array<DataTreeNodeT> = []
  let cur: DataTreeNodeT | null = target
  while (cur) {
    path.unshift(cur)
    cur = cur.parentId ? (byId.get(cur.parentId) ?? null) : null
  }
  return path
}

/** Re-fetch lazy folder children along the path to a node (after tree refresh). */
export async function reloadTreePathToNode(
  tree: DataTreeNodeT,
  targetNodeId: string,
  loadNodeChildrenFn: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<DataTreeNodeT> {
  const path = getPathToNode(tree, targetNodeId)
  let currentTree = tree

  for (const pathNode of path) {
    if (pathNode.type === 'folder') {
      currentTree = await loadNodeChildrenFn(pathNode.id)
    }
  }

  return currentTree
}

/** Dossier folder/record from `/all-first-subfolders` (has workflow `status`). */
export function isDossierWorkflowNode(node: DataTreeNodeT): boolean {
  return node.dossierStatus != null || node.entityType === 'DOCUMENT'
}

/** Context menu: "Phân biên tập" for dossier nodes with backend status. */
export function canShowAssignEditorAction(node: DataTreeNodeT): boolean {
  if (node.type === 'document') return false
  return isDossierWorkflowNode(node)
}

/** Context menu: "Phân công" for regular folders (not dossier workflow nodes). */
export function canShowAssignAction(
  node: DataTreeNodeT,
  options?: {
    role?: DataManagementRole
    parentNode?: DataTreeNodeT | null
  },
): boolean {
  if (node.type === 'document') return false
  if (!isDossierWorkflowNode(node)) return true

  // Admin: dossier trực tiếp dưới `raw` (vd. raw/218_CD/test.pdf) → cả Phân công + Phân biên tập
  if (
    options?.role === 'admin' &&
    options.parentNode?.name.toLowerCase() === 'raw'
  ) {
    return true
  }

  return false
}

/** Folder id for POST /api/v1/dossiers/assign-by-folder */
export function resolveAdminAssignFolderId(node: DataTreeNodeT): string {
  return node.folderId ?? node.id
}

export function canExportFolderMetadata(node: DataTreeNodeT): boolean {
  return node.type === 'folder' && node.id !== DATA_TREE_ROOT_ID
}

export function resolveFolderExportId(node: DataTreeNodeT): string {
  return node.folderId ?? node.id
}

/** Dossier id for PUT /api/v1/dossiers/:id (name, requiredQcCount) */
export function resolveDossierUpdateId(node: DataTreeNodeT): string | null {
  if (node.dossierId) return node.dossierId
  return null
}

/** Dossier entity id for POST /api/v1/dossiers/:id/assign */
export function resolveDossierEditorAssignId(
  node: DataTreeNodeT,
): string | null {
  if (!isDossierWorkflowNode(node)) return null
  if (node.dossierId) return node.dossierId
  // QC assignment tree uses dossier id as node id on record nodes
  if (node.entityType === 'DOCUMENT' && node.type === 'record') {
    return node.id
  }
  return null
}

export interface DossierFolderTarget {
  dossierId: string
  /** Folder id of the DOCUMENT entity (for editor assign API). */
  dossierFolderId: string
}

/** First dossier under a folder node (e.g. parent `1_swp391` → child `1_swp391` record). */
export function findDescendantDossierTarget(
  node: DataTreeNodeT,
): DossierFolderTarget | null {
  if (node.dossierId && isDossierWorkflowNode(node)) {
    return {
      dossierId: node.dossierId,
      dossierFolderId: node.folderId ?? node.id,
    }
  }

  for (const child of node.children) {
    if (child.dossierId && isDossierWorkflowNode(child)) {
      return {
        dossierId: child.dossierId,
        dossierFolderId: child.folderId ?? child.id,
      }
    }
    const nested = findDescendantDossierTarget(child)
    if (nested) return nested
  }

  return null
}

export function findParentNode(
  root: DataTreeNodeT,
  childId: string,
): DataTreeNodeT | null {
  if (root.children.some((child) => child.id === childId)) {
    return root
  }
  for (const child of root.children) {
    const found = findParentNode(child, childId)
    if (found) return found
  }
  return null
}

/** Record node for a document — uses tree structure (admin dossier parentId may be dossierId, not folder id). */
export function findRecordParentForDocument(
  root: DataTreeNodeT,
  documentId: string,
): DataTreeNodeT | null {
  const documentNode = findNodeById(root, documentId)
  if (!documentNode || documentNode.type !== 'document') return null

  const parentByTree = findParentNode(root, documentId)
  if (parentByTree?.type === 'record') return parentByTree

  if (documentNode.parentId) {
    const parentById = findNodeById(root, documentNode.parentId)
    if (parentById?.type === 'record') return parentById
  }

  return parentByTree
}

export interface DocumentFocusNavigationT {
  nodeId: string
  focusDocumentId: string
  focusGroupIndex?: number
}

/** Shared document-click focus logic (editor + admin). */
export function resolveDocumentFocusNavigation(
  root: DataTreeNodeT,
  documentId: string,
  options?: {
    nodeId?: string
    focusDocumentId?: string
    focusGroupIndex?: number
  },
): DocumentFocusNavigationT | null {
  const documentNode = findNodeById(root, documentId)
  if (!documentNode || documentNode.type !== 'document') return null

  const parent = findRecordParentForDocument(root, documentId)
  if (!parent || parent.type !== 'record') return null

  const recordDocuments = parent.children.filter(
    (child) => child.type === 'document',
  )
  const metadataGroups = parent.dossierMetadata?.metadata_groups ?? []
  const matchingGroupIndices = findAllMetadataGroupIndicesForDocument(
    metadataGroups,
    documentNode,
    recordDocuments,
  )

  const isRepeatDocumentClick =
    options?.nodeId === parent.id &&
    options?.focusDocumentId === documentId &&
    matchingGroupIndices.length > 1

  let focusGroupIndex: number | undefined
  if (matchingGroupIndices.length > 1) {
    if (isRepeatDocumentClick) {
      const currentGroupIndex =
        options?.focusGroupIndex ??
        findMetadataGroupIndexForDocument(
          metadataGroups,
          documentNode,
          recordDocuments,
        )
      const currentPosition = matchingGroupIndices.indexOf(currentGroupIndex)
      const basePosition = currentPosition >= 0 ? currentPosition : 0
      focusGroupIndex =
        matchingGroupIndices[(basePosition + 1) % matchingGroupIndices.length]
    } else {
      focusGroupIndex = findMetadataGroupIndexForDocument(
        metadataGroups,
        documentNode,
        recordDocuments,
      )
    }
  }

  return {
    nodeId: parent.id,
    focusDocumentId: documentId,
    focusGroupIndex,
  }
}

export function getRecordDocuments(
  root: DataTreeNodeT,
  documentId: string,
): Array<DataTreeNodeT> {
  const parent = findParentNode(root, documentId)
  if (!parent) return []
  return parent.children.filter((child) => child.type === 'document')
}

export function resolveRecordDossierId(
  node: DataTreeNodeT | null,
): string | null {
  if (!node) return null
  return node.dossierId ?? node.id
}

export function updateDossierMetadataInTree(
  root: DataTreeNodeT,
  dossierId: string,
  metadata: DataTreeNodeT['dossierMetadata'],
): DataTreeNodeT {
  function visit(node: DataTreeNodeT): DataTreeNodeT {
    const isTarget = node.id === dossierId || node.dossierId === dossierId
    const nextNode =
      isTarget && metadata
        ? syncRecordDocumentFields(node, metadata)
        : isTarget
          ? { ...node, dossierMetadata: metadata }
          : node
    return {
      ...nextNode,
      children: nextNode.children.map(visit),
    }
  }
  return visit(root)
}

export function filterTreeForSearch(
  root: DataTreeNodeT,
  q: string,
): DataTreeNodeT {
  const needle = q.trim().toLowerCase()
  if (!needle) return root

  function filt(n: DataTreeNodeT): DataTreeNodeT | null {
    const kids = n.children
      .map(filt)
      .filter((x): x is DataTreeNodeT => x != null)
    const selfMatch = n.name.toLowerCase().includes(needle)
    if (selfMatch || kids.length > 0) {
      return { ...n, children: kids }
    }
    return null
  }

  return filt(root) ?? { ...root, children: [] }
}
