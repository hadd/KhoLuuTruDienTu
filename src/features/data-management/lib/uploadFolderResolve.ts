import type { DataTreeNodeT } from '@/features/data-management/types'

import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import { collectOcrWatchFolderIds } from '@/features/data-management/lib/treeUtils'

/** `/raw/218_CD/file.pdf` → anchor `raw`, parent folder names `[218_CD]`. */
export function parseStorageKeyFolderSegments(storageKey: string): {
  anchorSegment: string
  parentSegments: Array<string>
} {
  const parts = storageKey.replace(/^\/+/, '').split('/').filter(Boolean)
  if (parts.length === 0) {
    return { anchorSegment: '', parentSegments: [] }
  }

  const anchorSegment = parts[0]
  const parentSegments = parts.length > 2 ? parts.slice(1, -1) : []
  return { anchorSegment, parentSegments }
}

function findNodeInTree(
  root: DataTreeNodeT,
  id: string,
): DataTreeNodeT | null {
  if (root.id === id) return root
  for (const child of root.children) {
    const found = findNodeInTree(child, id)
    if (found) return found
  }
  return null
}

function findChildByName(
  node: DataTreeNodeT,
  segment: string,
): DataTreeNodeT | null {
  const normalized = segment.trim().toLowerCase()
  return (
    node.children.find((child) => child.name.trim().toLowerCase() === normalized) ??
    null
  )
}

function absorbOcrNodes(
  root: DataTreeNodeT,
  folderIds: Set<string>,
  dossierIds: Set<string>,
): void {
  for (const folderId of collectOcrWatchFolderIds(root)) {
    folderIds.add(folderId)
  }

  function walk(node: DataTreeNodeT, listingFolderId: string | null) {
    if (node.dossierStatus === 'OCR_PROCESSING') {
      if (listingFolderId && listingFolderId !== DATA_TREE_ROOT_ID) {
        folderIds.add(listingFolderId)
      }
      if (node.id !== DATA_TREE_ROOT_ID) {
        folderIds.add(node.id)
      }
      if (node.folderId) folderIds.add(node.folderId)
    }
    if (node.dossierId) dossierIds.add(node.dossierId)

    const childListingId =
      node.type === 'folder' && node.id !== DATA_TREE_ROOT_ID
        ? node.id
        : listingFolderId

    for (const child of node.children) {
      walk(child, childListingId)
    }
  }

  walk(root, null)
}

/** Load folder branches and collect socket room ids for OCR in progress. */
export async function discoverOcrWatchTargets(
  tree: DataTreeNodeT,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<{ folderIds: Array<string>; dossierIds: Array<string> }> {
  const folderIds = new Set<string>()
  const dossierIds = new Set<string>()

  absorbOcrNodes(tree, folderIds, dossierIds)

  for (const topFolder of tree.children) {
    if (topFolder.type !== 'folder') continue

    let loadedTree: DataTreeNodeT
    try {
      loadedTree = await loadNodeChildren(topFolder.id)
    } catch {
      continue
    }

    absorbOcrNodes(loadedTree, folderIds, dossierIds)
    folderIds.add(topFolder.id)

    const loadedTop = findNodeInTree(loadedTree, topFolder.id)
    for (const child of loadedTop?.children ?? []) {
      if (
        child.dossierStatus === 'OCR_PROCESSING' ||
        child.entityType === 'DOCUMENT'
      ) {
        folderIds.add(topFolder.id)
        folderIds.add(child.id)
        if (child.folderId) folderIds.add(child.folderId)
        if (child.dossierId) dossierIds.add(child.dossierId)
      }

      if (child.type !== 'folder') continue

      try {
        const deepTree = await loadNodeChildren(child.id)
        absorbOcrNodes(deepTree, folderIds, dossierIds)
        folderIds.add(child.id)
      } catch {
        // ignore single folder load failure
      }
    }
  }

  return {
    folderIds: [...folderIds],
    dossierIds: [...dossierIds],
  }
}

export async function resolveFolderIdFromStorageKey(
  tree: DataTreeNodeT,
  storageKey: string,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<{ folderId: string; navigateNodeId: string } | null> {
  const { anchorSegment, parentSegments } =
    parseStorageKeyFolderSegments(storageKey)
  if (!anchorSegment) return null

  let currentNode = findChildByName(tree, anchorSegment)
  if (!currentNode) return null

  try {
    const loadedTree = await loadNodeChildren(currentNode.id)
    currentNode = findNodeInTree(loadedTree, currentNode.id) ?? currentNode
  } catch {
    return null
  }

  for (const segment of parentSegments) {
    const nextNode = findChildByName(currentNode, segment)
    if (!nextNode) return null

    try {
      const loadedTree = await loadNodeChildren(nextNode.id)
      currentNode = findNodeInTree(loadedTree, nextNode.id) ?? nextNode
    } catch {
      return null
    }
  }

  return { folderId: currentNode.id, navigateNodeId: currentNode.id }
}
