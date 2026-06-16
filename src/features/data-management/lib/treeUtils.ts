import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import {
  findAllMetadataGroupIndicesForDocument,
  findMetadataGroupIndexForDocument,
  resolveDocumentMetadataFields,
} from '@/features/data-management/lib/metadataHelpers'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type {
  DataDossierMetadataT,
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'
import type { SocketRoomSetsT } from '@/lib/socket/types'

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

/** Dossier statuses that should subscribe to realtime OCR socket rooms. */
const OCR_PENDING_STATUSES = new Set<string>(['NEW', 'OCR_PROCESSING', 'OCR_FAILED'])

function isOcrPendingNode(node: DataTreeNodeT): boolean {
  return (
    node.dossierStatus != null && OCR_PENDING_STATUSES.has(node.dossierStatus)
  )
}

/** Add folder + dossier socket room ids for a single pending OCR node. */
export function absorbPendingOcrRoomsFromNode(
  node: DataTreeNodeT,
  listingFolderId: string | null,
  folderIds: Set<string>,
  dossierIds: Set<string>,
): void {
  if (!isOcrPendingNode(node)) return

  if (listingFolderId && listingFolderId !== DATA_TREE_ROOT_ID) {
    folderIds.add(listingFolderId)
  }
  if (node.id !== DATA_TREE_ROOT_ID) {
    folderIds.add(node.id)
  }
  if (node.folderId) {
    folderIds.add(node.folderId)
  }

  const dossierId = resolveRecordDossierId(node)
  if (dossierId) {
    dossierIds.add(dossierId)
  }
}

function walkPendingOcrRooms(
  node: DataTreeNodeT,
  listingFolderId: string | null,
  folderIds: Set<string>,
  dossierIds: Set<string>,
): void {
  absorbPendingOcrRoomsFromNode(node, listingFolderId, folderIds, dossierIds)

  const childListingId =
    node.type === 'folder' && node.id !== DATA_TREE_ROOT_ID
      ? node.id
      : listingFolderId

  for (const child of node.children) {
    walkPendingOcrRooms(child, childListingId, folderIds, dossierIds)
  }
}

/** Collect folder + dossier socket room ids from a loaded tree subtree. */
export function collectOcrRoomIdsFromTree(root: DataTreeNodeT): {
  folderIds: Array<string>
  dossierIds: Array<string>
} {
  const folderIds = new Set<string>()
  const dossierIds = new Set<string>()
  walkPendingOcrRooms(root, null, folderIds, dossierIds)
  return {
    folderIds: [...folderIds],
    dossierIds: [...dossierIds],
  }
}

/** Parent folder ids to join for realtime OCR updates (loaded tree only). */
export function collectOcrWatchFolderIds(root: DataTreeNodeT): Array<string> {
  return collectOcrRoomIdsFromTree(root).folderIds
}

/** Dossier entity ids to join for realtime OCR updates (loaded tree only). */
export function collectOcrWatchDossierIds(root: DataTreeNodeT): Array<string> {
  return collectOcrRoomIdsFromTree(root).dossierIds
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

/** Context menu: assign folder/bộ hồ sơ to a group (admin only). */
export function canShowAssignGroupAction(node: DataTreeNodeT): boolean {
  if (node.type !== 'folder') return false
  if (node.id === DATA_TREE_ROOT_ID) return false
  return true
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

export type DataDeleteTargetT = {
  target: 'dossier' | 'folder'
  id: string
  descriptionKey: 'descriptionDossier' | 'descriptionFolder'
}

/** Resolve DELETE target — dossier id for hồ sơ, folder id for thư mục / bộ hồ sơ. */
export function resolveDeleteTarget(
  node: DataTreeNodeT,
  tree?: DataTreeNodeT | null,
): DataDeleteTargetT | null {
  if (node.id === DATA_TREE_ROOT_ID) return null

  if (node.type === 'document') {
    if (!tree) return null
    const record = findRecordParentForDocument(tree, node.id)
    const dossierId = record ? resolveRecordDossierId(record) : null
    if (!dossierId) return null
    return {
      target: 'dossier',
      id: dossierId,
      descriptionKey: 'descriptionDossier',
    }
  }

  if (node.type === 'record' || isDossierWorkflowNode(node)) {
    const dossierId =
      resolveDossierEditorAssignId(node) ??
      resolveDossierUpdateId(node) ??
      (node.type === 'record' ? resolveRecordDossierId(node) : null)
    if (!dossierId) return null
    return {
      target: 'dossier',
      id: dossierId,
      descriptionKey: 'descriptionDossier',
    }
  }

  if (node.type === 'folder') {
    return {
      target: 'folder',
      id: node.folderId ?? node.id,
      descriptionKey: 'descriptionFolder',
    }
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

/** True when `nodeId` is the ancestor or any of its descendants. */
export function isNodeUnderAncestor(
  tree: DataTreeNodeT,
  nodeId: string,
  ancestorId: string,
): boolean {
  if (nodeId === ancestorId) return true
  return getPathToNode(tree, nodeId).some((n) => n.id === ancestorId)
}

/** Folder ids whose children should be re-fetched after a node delete (parent listing). */
export function resolveFoldersToReloadAfterDelete(
  tree: DataTreeNodeT,
  deletedNodeId: string,
): Array<string> {
  const folderIds = new Set<string>()
  const parent = findParentNode(tree, deletedNodeId)

  if (!parent) {
    folderIds.add(DATA_TREE_ROOT_ID)
    return [...folderIds]
  }

  if (parent.type === 'folder') {
    folderIds.add(parent.id)
  } else {
    const folderAncestor = findParentNode(tree, parent.id)
    if (folderAncestor?.type === 'folder') {
      folderIds.add(folderAncestor.id)
    } else {
      folderIds.add(DATA_TREE_ROOT_ID)
    }
  }

  return [...folderIds]
}

/** Navigate target when the current selection was removed from the tree. */
export function resolveSelectionAfterDelete(
  tree: DataTreeNodeT,
  deletedNodeId: string,
  currentNodeId: string | undefined,
): string | null {
  if (!currentNodeId) return null
  if (!isNodeUnderAncestor(tree, currentNodeId, deletedNodeId)) return null

  const parent = findParentNode(tree, deletedNodeId)
  return parent?.id ?? DATA_TREE_ROOT_ID
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

function resolveDossierJoinId(
  node: DataTreeNodeT | null,
  dossierId?: string | null,
): string | null {
  if (!node) return null
  if (node.type === 'record') {
    return resolveRecordDossierId(node)
  }
  if (node.entityType === 'DOCUMENT' && node.dossierId) {
    return node.dossierId
  }
  return dossierId ?? null
}

/** Always join rooms for the node the user is viewing, regardless of OCR status. */
function absorbSelectedNodeWatchRooms(
  node: DataTreeNodeT | null,
  dossierId: string | null | undefined,
  folderIds: Set<string>,
  dossierIds: Set<string>,
): void {
  if (!node) {
    if (dossierId?.trim()) dossierIds.add(dossierId)
    return
  }

  if (node.type === 'folder' && node.id !== DATA_TREE_ROOT_ID) {
    folderIds.add(node.id)
    if (node.folderId) folderIds.add(node.folderId)
  }

  if (node.type === 'record') {
    if (node.id !== DATA_TREE_ROOT_ID) folderIds.add(node.id)
    if (node.folderId) folderIds.add(node.folderId)
    const recordDossierId = resolveRecordDossierId(node)
    if (recordDossierId) dossierIds.add(recordDossierId)
  }

  if (node.type === 'document') {
    if (node.parentId && node.parentId !== DATA_TREE_ROOT_ID) {
      folderIds.add(node.parentId)
    }
    if (node.folderId) folderIds.add(node.folderId)
  }

  const resolvedDossierId = resolveDossierJoinId(node, dossierId)
  if (resolvedDossierId) dossierIds.add(resolvedDossierId)

  if (dossierId?.trim()) dossierIds.add(dossierId)
}

/** Folder + dossier ids to join for realtime OCR updates. */
export function resolveSocketJoinIds(
  tree: DataTreeNodeT | null,
  selectedNode: DataTreeNodeT | null,
  dossierId: string | null | undefined,
  extraWatchFolderIds: Array<string>,
  extraWatchDossierIds: Array<string>,
): SocketRoomSetsT {
  const folderIds = new Set<string>()
  const dossierIds = new Set<string>()

  absorbSelectedNodeWatchRooms(selectedNode, dossierId, folderIds, dossierIds)

  if (tree) {
    for (const folderId of collectOcrWatchFolderIds(tree)) {
      folderIds.add(folderId)
    }
    for (const id of collectOcrWatchDossierIds(tree)) {
      dossierIds.add(id)
    }
  }

  for (const folderId of extraWatchFolderIds) {
    if (folderId.trim()) folderIds.add(folderId)
  }

  for (const id of extraWatchDossierIds) {
    if (id.trim()) dossierIds.add(id)
  }

  return {
    folderIds: [...folderIds],
    dossierIds: [...dossierIds],
  }
}

export function updateDossierStatusInTree(
  root: DataTreeNodeT,
  {
    dossierId,
    folderId,
    status,
  }: {
    dossierId: string
    folderId?: string
    status: DataDossierStatus
  },
): DataTreeNodeT {
  function matchesNode(node: DataTreeNodeT): boolean {
    const idMatches =
      node.dossierId === dossierId ||
      node.id === dossierId ||
      (folderId != null &&
        (node.folderId === folderId || node.id === folderId))

    if (!idMatches) return false

    return (
      node.dossierStatus != null ||
      node.entityType === 'DOCUMENT' ||
      node.type === 'record'
    )
  }

  function visit(node: DataTreeNodeT): DataTreeNodeT {
    const nextNode = matchesNode(node)
      ? {
          ...node,
          dossierStatus: status,
          ...(node.dossierMetadata
            ? {
                dossierMetadata: {
                  ...node.dossierMetadata,
                  trang_thai_ho_so: status,
                },
              }
            : {}),
        }
      : node

    return {
      ...nextNode,
      children: nextNode.children.map(visit),
    }
  }

  return visit(root)
}

function nodeMatchesOcrTarget(
  node: DataTreeNodeT,
  payload: { dossierId: string; folderId: string },
): boolean {
  return (
    node.dossierId === payload.dossierId ||
    node.id === payload.dossierId ||
    node.id === payload.folderId ||
    node.folderId === payload.folderId
  )
}

/** Current dossier status held in the tree for an OCR target, if loaded. */
export function findDossierStatusInTree(
  root: DataTreeNodeT,
  payload: { dossierId: string; folderId?: string },
): DataDossierStatus | null {
  let found: DataDossierStatus | null = null

  function walk(node: DataTreeNodeT): void {
    if (found != null) return
    const idMatches =
      node.dossierId === payload.dossierId ||
      node.id === payload.dossierId ||
      (payload.folderId != null &&
        (node.folderId === payload.folderId || node.id === payload.folderId))

    if (idMatches && node.dossierStatus != null) {
      found = node.dossierStatus
      return
    }

    for (const child of node.children) {
      walk(child)
    }
  }

  walk(root)
  return found
}

/** Folder whose children listing should be re-fetched after OCR updates. */
function resolveListingFolderForMatchedNode(
  root: DataTreeNodeT,
  node: DataTreeNodeT,
): string | null {
  const path = getPathToNode(root, node.id)
  if (path.length === 0) return null

  const nodeIndex = path.findIndex((pathNode) => pathNode.id === node.id)
  if (nodeIndex < 0) return null

  if (node.type === 'record' || node.type === 'document') {
    for (let index = nodeIndex - 1; index >= 0; index -= 1) {
      const ancestor = path[index]
      if (ancestor.type === 'folder' && ancestor.id !== DATA_TREE_ROOT_ID) {
        return ancestor.id
      }
    }
    if (node.folderId && node.folderId !== DATA_TREE_ROOT_ID) {
      return node.folderId
    }
    return null
  }

  if (node.type === 'folder') {
    for (let index = nodeIndex - 1; index >= 0; index -= 1) {
      const ancestor = path[index]
      if (ancestor.type === 'folder' && ancestor.id !== DATA_TREE_ROOT_ID) {
        return ancestor.id
      }
    }
    return node.id !== DATA_TREE_ROOT_ID ? node.id : null
  }

  return null
}

export function resolveOcrReloadFolderIds(
  root: DataTreeNodeT,
  payload: { dossierId: string; folderId: string },
): Array<string> {
  const ids = new Set<string>()

  function walk(node: DataTreeNodeT) {
    if (nodeMatchesOcrTarget(node, payload)) {
      const listingFolderId = resolveListingFolderForMatchedNode(root, node)
      if (listingFolderId) ids.add(listingFolderId)
    }

    for (const child of node.children) {
      walk(child)
    }
  }

  walk(root)

  if (ids.size === 0 && payload.folderId) {
    ids.add(payload.folderId)
  }

  return [...ids]
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

/** Remove all document nodes, keeping only folder/record structure. */
export function filterTreeFoldersOnly(root: DataTreeNodeT): DataTreeNodeT {
  return {
    ...root,
    children: root.children
      .filter((child) => child.type !== 'document')
      .map(filterTreeFoldersOnly),
  }
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
