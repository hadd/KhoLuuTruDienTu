import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import {
  findAllMetadataGroupIndicesForDocument,
  findMetadataGroupIndexForDocument,
  resolveDocumentMetadataFields,
} from '@/features/data-management/lib/metadataHelpers'
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
  role: DataManagementRole = 'admin',
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
const OCR_PENDING_STATUSES = new Set<string>([
  'NEW',
  'OCR_PROCESSING',
  'OCR_FAILED',
])

/** Dossier statuses that should trigger periodic poll refresh (excludes terminal OCR_FAILED). */
const OCR_POLL_STATUSES = new Set<string>(['NEW', 'OCR_PROCESSING'])

function isOcrPollPendingNode(node: DataTreeNodeT): boolean {
  return node.dossierStatus != null && OCR_POLL_STATUSES.has(node.dossierStatus)
}

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

/** True when the API marks this node as assigned (`isAssigned: true`). */
export function hasAssignedIndicator(node: DataTreeNodeT): boolean {
  if (node.suppressAssignedIndicator) return false
  return node.isAssigned === true
}

/** Context menu: "Phân biên tập" for dossier nodes with backend status. */
export function canShowAssignEditorAction(node: DataTreeNodeT): boolean {
  if (node.type === 'document') return false
  return isDossierWorkflowNode(node)
}

/** Context menu: revoke folder assignments (admin / QC). */
export function canShowRevokeAssignmentsAction(node: DataTreeNodeT): boolean {
  if (node.type !== 'folder') return false
  if (node.id === DATA_TREE_ROOT_ID) return false
  return true
}

/** Context menu: assign folder/bộ hồ sơ to a group (admin only). */
export function canShowAssignGroupAction(node: DataTreeNodeT): boolean {
  if (node.type !== 'folder') return false
  if (node.id === DATA_TREE_ROOT_ID) return false
  return true
}

/** Context menu: "Phân công" for regular folders and admin dossier workflow nodes. */
export function canShowAssignAction(
  node: DataTreeNodeT,
  options?: {
    role?: DataManagementRole
  },
): boolean {
  if (node.type === 'document') return false
  if (!isDossierWorkflowNode(node)) return true

  // Admin: mọi dossier workflow node ở bất kỳ độ sâu (vd. raw/hoso5/hoso5.1/test.pdf)
  if (options?.role === 'admin') return true

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
    const collected = collectOcrRoomIdsFromTree(tree)
    for (const folderId of collected.folderIds) {
      folderIds.add(folderId)
    }
    for (const id of collected.dossierIds) {
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
): { tree: DataTreeNodeT; updated: boolean } {
  function matchesNode(node: DataTreeNodeT): boolean {
    const idMatches =
      node.dossierId === dossierId ||
      node.id === dossierId ||
      (folderId != null && (node.folderId === folderId || node.id === folderId))

    if (!idMatches) return false

    return (
      node.dossierStatus != null ||
      node.entityType === 'DOCUMENT' ||
      node.type === 'record'
    )
  }

  function visit(node: DataTreeNodeT): {
    node: DataTreeNodeT
    changed: boolean
  } {
    let childrenChanged = false
    const nextChildren: Array<DataTreeNodeT> = []

    for (const child of node.children) {
      const result = visit(child)
      nextChildren.push(result.node)
      if (result.changed) childrenChanged = true
    }

    if (matchesNode(node)) {
      const updatedNode: DataTreeNodeT = {
        ...node,
        dossierStatus: status,
        children: childrenChanged ? nextChildren : node.children,
        ...(node.dossierMetadata
          ? {
              dossierMetadata: {
                ...node.dossierMetadata,
                trang_thai_ho_so: status,
              },
            }
          : {}),
      }
      return { node: updatedNode, changed: true }
    }

    if (!childrenChanged) {
      return { node, changed: false }
    }

    return {
      node: { ...node, children: nextChildren },
      changed: true,
    }
  }

  const result = visit(root)
  return { tree: result.node, updated: result.changed }
}

/** Shallow listing fields compared when merging folder children after refetch. */
function isListingChildShallowEqual(
  existing: DataTreeNodeT,
  incoming: DataTreeNodeT,
): boolean {
  return (
    existing.name === incoming.name &&
    existing.type === incoming.type &&
    existing.dossierStatus === incoming.dossierStatus &&
    existing.isAssigned === incoming.isAssigned &&
    existing.entityType === incoming.entityType &&
    existing.dossierId === incoming.dossierId &&
    existing.folderId === incoming.folderId &&
    existing.sizeBytes === incoming.sizeBytes
  )
}

function mergeListingChildFields(
  existing: DataTreeNodeT,
  incoming: DataTreeNodeT,
): DataTreeNodeT {
  return {
    ...existing,
    name: incoming.name,
    type: incoming.type,
    dossierStatus: incoming.dossierStatus,
    isAssigned: incoming.isAssigned,
    entityType: incoming.entityType,
    dossierId: incoming.dossierId,
    folderId: incoming.folderId,
    sizeBytes: incoming.sizeBytes,
    uploadedAt: incoming.uploadedAt,
    uploadedBy: incoming.uploadedBy,
  }
}

/** Listing stub from `/all-first-subfolders` before lazy dossier expand. */
function isDossierListingStub(node: DataTreeNodeT): boolean {
  return (
    node.type === 'folder' &&
    (node.entityType === 'DOCUMENT' || node.dossierStatus != null)
  )
}

function isListingFieldsShallowEqual(
  existing: DataTreeNodeT,
  incoming: DataTreeNodeT,
): boolean {
  return (
    existing.name === incoming.name &&
    existing.dossierStatus === incoming.dossierStatus &&
    existing.isAssigned === incoming.isAssigned &&
    existing.entityType === incoming.entityType &&
    existing.dossierId === incoming.dossierId &&
    existing.folderId === incoming.folderId &&
    existing.sizeBytes === incoming.sizeBytes
  )
}

/** Update listing badge fields on an expanded record without stripping content. */
function mergeListingChildFieldsPreservingRecord(
  existing: DataTreeNodeT,
  incoming: DataTreeNodeT,
): DataTreeNodeT {
  return {
    ...mergeListingChildFields(existing, incoming),
    type: 'record',
    children: existing.children,
    dossierMetadata: existing.dossierMetadata,
    fullDossierMetadata: existing.fullDossierMetadata,
  }
}

/**
 * Merge API listing children into existing tree nodes, preserving object
 * references when only badge/status fields changed (reduces re-render jitter).
 */
export function mergeListingChildren(
  existing: Array<DataTreeNodeT>,
  incoming: Array<DataTreeNodeT>,
): { children: Array<DataTreeNodeT>; changed: boolean } {
  if (existing.length !== incoming.length) {
    return { children: incoming, changed: true }
  }

  const existingById = new Map(existing.map((child) => [child.id, child]))
  let changed = false
  const merged: Array<DataTreeNodeT> = []

  for (let index = 0; index < incoming.length; index += 1) {
    const incomingChild = incoming[index]
    const existingAtIndex = existing[index]
    if (!incomingChild || !existingAtIndex) {
      return { children: incoming, changed: true }
    }

    const existingChild = existingById.get(incomingChild.id)

    if (!existingChild || existingAtIndex.id !== incomingChild.id) {
      return { children: incoming, changed: true }
    }

    if (existingChild.type !== incomingChild.type) {
      if (
        existingChild.type === 'record' &&
        incomingChild.type === 'folder' &&
        isDossierListingStub(incomingChild)
      ) {
        if (!isListingFieldsShallowEqual(existingChild, incomingChild)) {
          changed = true
        }
        merged.push(
          mergeListingChildFieldsPreservingRecord(existingChild, incomingChild),
        )
        continue
      }

      return { children: incoming, changed: true }
    }

    if (isListingChildShallowEqual(existingChild, incomingChild)) {
      merged.push(existingChild)
      continue
    }

    merged.push(mergeListingChildFields(existingChild, incomingChild))
    changed = true
  }

  return { children: merged, changed }
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
function buildTreeNodeIndex(root: DataTreeNodeT): Map<string, DataTreeNodeT> {
  const byId = new Map<string, DataTreeNodeT>()

  function index(node: DataTreeNodeT): void {
    byId.set(node.id, node)
    for (const child of node.children) {
      index(child)
    }
  }

  index(root)
  return byId
}

function resolveListingFolderForMatchedNodeFromIndex(
  byId: Map<string, DataTreeNodeT>,
  node: DataTreeNodeT,
): string | null {
  if (node.type === 'record' || node.type === 'document') {
    let current: DataTreeNodeT | null = node
    while (current?.parentId) {
      const parent = byId.get(current.parentId) ?? null
      if (parent?.type === 'folder' && parent.id !== DATA_TREE_ROOT_ID) {
        return parent.id
      }
      current = parent
    }
    if (node.folderId && node.folderId !== DATA_TREE_ROOT_ID) {
      return node.folderId
    }
    return null
  }

  if (node.type === 'folder') {
    let current: DataTreeNodeT | null = node
    while (current?.parentId) {
      const parent = byId.get(current.parentId) ?? null
      if (parent?.type === 'folder' && parent.id !== DATA_TREE_ROOT_ID) {
        return parent.id
      }
      current = parent
    }
    return node.id !== DATA_TREE_ROOT_ID ? node.id : null
  }

  return null
}

/** Folder ids whose children listing should be re-fetched while OCR is in progress. */
export function collectOcrPendingListingFolderIds(
  root: DataTreeNodeT,
): Array<string> {
  const ids = new Set<string>()
  const byId = buildTreeNodeIndex(root)

  function walk(node: DataTreeNodeT): void {
    if (isOcrPollPendingNode(node)) {
      const listingFolderId = resolveListingFolderForMatchedNodeFromIndex(
        byId,
        node,
      )
      ids.add(listingFolderId ?? DATA_TREE_ROOT_ID)
    }

    for (const child of node.children) {
      walk(child)
    }
  }

  walk(root)
  return [...ids]
}

export function resolveOcrReloadFolderIds(
  root: DataTreeNodeT,
  payload: { dossierId: string; folderId: string },
): Array<string> {
  const ids = new Set<string>()
  const byId = buildTreeNodeIndex(root)

  function walk(node: DataTreeNodeT) {
    if (nodeMatchesOcrTarget(node, payload)) {
      const listingFolderId = resolveListingFolderForMatchedNodeFromIndex(
        byId,
        node,
      )
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

function shouldReloadListingFolderFromIndex(
  byId: Map<string, DataTreeNodeT>,
  folderId: string,
): boolean {
  const folder = byId.get(folderId)
  if (!folder || folder.type !== 'folder') return false

  return folder.children.some((child) => isOcrPollPendingNode(child))
}

/** True when a listing folder still has at least one direct child in OCR poll range. */
export function shouldReloadListingFolder(
  root: DataTreeNodeT,
  folderId: string,
): boolean {
  return shouldReloadListingFolderFromIndex(buildTreeNodeIndex(root), folderId)
}

function listingFolderContainsDossierFromIndex(
  byId: Map<string, DataTreeNodeT>,
  listingFolderId: string,
  dossierId: string,
): boolean {
  const folder = byId.get(listingFolderId)
  if (!folder) return false

  function matchesDossier(node: DataTreeNodeT): boolean {
    return node.dossierId === dossierId || node.id === dossierId
  }

  function walk(node: DataTreeNodeT): boolean {
    if (matchesDossier(node)) return true
    return node.children.some(walk)
  }

  return folder.children.some(walk)
}

function listingFolderContainsDossier(
  root: DataTreeNodeT,
  listingFolderId: string,
  dossierId: string,
): boolean {
  return listingFolderContainsDossierFromIndex(
    buildTreeNodeIndex(root),
    listingFolderId,
    dossierId,
  )
}

/** Narrow OCR listing reload targets — pending-only for poll, dossier-scoped for terminal events. */
export function filterOcrReloadFolderIds(
  root: DataTreeNodeT,
  folderIds: Array<string>,
  payload?: { dossierId: string; folderId?: string },
): Array<string> {
  const byId = buildTreeNodeIndex(root)

  return folderIds.filter((folderId) => {
    if (payload) {
      if (payload.folderId && folderId === payload.folderId) {
        return true
      }
      return listingFolderContainsDossierFromIndex(
        byId,
        folderId,
        payload.dossierId,
      )
    }
    return shouldReloadListingFolderFromIndex(byId, folderId)
  })
}

const OCR_STABLE_VIEW_STATUSES = new Set<DataDossierStatus>([
  'READY_FOR_ENTRY',
  'OCR_FAILED',
])

/**
 * Skip reloading the parent listing folder when the user is viewing a terminal
 * dossier and the OCR event concerns a sibling under the same listing.
 * Poll reloads are always skipped for the viewing listing; terminal events still
 * refresh the parent when the completed dossier lives in that listing.
 */
export function excludeStableViewingFromReload(
  folderIds: Array<string>,
  selectedNode: DataTreeNodeT | null,
  payload?: { dossierId: string; folderId?: string },
  root?: DataTreeNodeT | null,
): Array<string> {
  if (!selectedNode?.dossierStatus) return folderIds
  if (!OCR_STABLE_VIEW_STATUSES.has(selectedNode.dossierStatus)) {
    return folderIds
  }

  const viewingDossierId = resolveRecordDossierId(selectedNode)
  if (!viewingDossierId) return folderIds

  if (payload?.dossierId === viewingDossierId) return folderIds

  const viewingListingFolderId =
    selectedNode.folderId ??
    (selectedNode.parentId && selectedNode.parentId !== DATA_TREE_ROOT_ID
      ? selectedNode.parentId
      : null)

  if (!viewingListingFolderId) return folderIds

  return folderIds.filter((folderId) => {
    if (folderId !== viewingListingFolderId) return true

    if (payload && root) {
      return listingFolderContainsDossier(root, folderId, payload.dossierId)
    }

    return false
  })
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
        ? syncRecordDocumentFields(
            {
              ...node,
              dossierMetadata: metadata,
              fullDossierMetadata: metadata,
            },
            metadata,
          )
        : isTarget
          ? {
              ...node,
              dossierMetadata: metadata,
              fullDossierMetadata: metadata,
            }
          : node
    return {
      ...nextNode,
      children: nextNode.children.map(visit),
    }
  }
  return visit(root)
}

export function updateDossierPendingIssueReportCountInTree(
  root: DataTreeNodeT,
  dossierId: string,
  pendingIssueReportCount: number,
): DataTreeNodeT {
  function visit(node: DataTreeNodeT): DataTreeNodeT {
    const isTarget =
      node.type === 'record' &&
      (node.dossierId === dossierId || node.id === dossierId)
    const nextChildren = node.children.map(visit)

    if (!isTarget) {
      return { ...node, children: nextChildren }
    }

    if (pendingIssueReportCount <= 0) {
      const { pendingIssueReportCount: _removed, ...rest } = node
      return { ...rest, children: nextChildren }
    }

    return {
      ...node,
      pendingIssueReportCount,
      children: nextChildren,
    }
  }

  return visit(root)
}

export function decrementDossierPendingIssueReportCountInTree(
  root: DataTreeNodeT,
  dossierId: string,
): DataTreeNodeT {
  function visit(node: DataTreeNodeT): DataTreeNodeT {
    const isTarget =
      node.type === 'record' &&
      (node.dossierId === dossierId || node.id === dossierId)
    const nextChildren = node.children.map(visit)

    if (!isTarget) {
      return { ...node, children: nextChildren }
    }

    const nextCount = Math.max(0, (node.pendingIssueReportCount ?? 1) - 1)
    return updateDossierPendingIssueReportCountInTree(
      { ...node, children: nextChildren },
      dossierId,
      nextCount,
    )
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
