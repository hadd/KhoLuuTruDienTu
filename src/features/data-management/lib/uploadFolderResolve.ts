import type { UploadPathConflict } from '@/features/data-management/api/dossierClient'
import type { DataTreeNodeT } from '@/features/data-management/types'

import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import { collectOcrRoomIdsFromTree } from '@/features/data-management/lib/treeUtils'

const DOSSIER_RESOLVE_CONCURRENCY = 8

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

/** `/raw/218_CD/doc.pdf` → anchor `raw`, parent `[218_CD]`, fileName `doc.pdf`. */
export function parseStorageKeyFileRef(storageKey: string): {
  anchorSegment: string
  parentSegments: Array<string>
  fileName: string
} {
  const parts = storageKey.replace(/^\/+/, '').split('/').filter(Boolean)
  if (parts.length === 0) {
    return { anchorSegment: '', parentSegments: [], fileName: '' }
  }

  const fileName = parts[parts.length - 1] ?? ''
  const anchorSegment = parts[0] ?? ''
  const parentSegments = parts.length > 2 ? parts.slice(1, -1) : []
  return { anchorSegment, parentSegments, fileName }
}

function normalizePdfName(name: string): string {
  return name.trim().toLowerCase().replace(/\.pdf$/i, '')
}

function filePathMatchesStorageKey(
  filePath: string,
  storageKey: string,
  fileName: string,
): boolean {
  const normalizedPath = filePath.replace(/^\/+/, '').toLowerCase()
  const normalizedKey = storageKey.replace(/^\/+/, '').toLowerCase()
  const normalizedName = fileName.toLowerCase()

  return (
    normalizedPath === normalizedKey ||
    normalizedPath.endsWith(`/${normalizedName}`) ||
    normalizedPath.endsWith(normalizedName)
  )
}

function nodeMatchesUploadFile(
  node: DataTreeNodeT,
  storageKey: string,
  fileName: string,
): boolean {
  if (node.filePath && filePathMatchesStorageKey(node.filePath, storageKey, fileName)) {
    return true
  }
  return normalizePdfName(node.name) === normalizePdfName(fileName)
}

function resolveDossierIdFromNode(
  node: DataTreeNodeT,
  storageKey: string,
  fileName: string,
): string | null {
  if (node.dossierId && node.entityType === 'DOCUMENT') {
    if (
      node.type === 'record' &&
      node.children.some((child) => nodeMatchesUploadFile(child, storageKey, fileName))
    ) {
      return node.dossierId
    }
    if (nodeMatchesUploadFile(node, storageKey, fileName)) {
      return node.dossierId
    }
  }

  for (const child of node.children) {
    if (child.entityType === 'DOCUMENT' && child.dossierId) {
      if (nodeMatchesUploadFile(child, storageKey, fileName)) {
        return child.dossierId
      }
      if (
        child.children.some((doc) =>
          nodeMatchesUploadFile(doc, storageKey, fileName),
        )
      ) {
        return child.dossierId
      }
    }
  }

  return null
}

async function mapWithConcurrency<T, R>(
  items: Array<T>,
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<Array<R>> {
  const results: Array<R> = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
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

function mergeOcrRoomIdsFromTree(
  root: DataTreeNodeT,
  folderIds: Set<string>,
  dossierIds: Set<string>,
): void {
  const collected = collectOcrRoomIdsFromTree(root)
  for (const folderId of collected.folderIds) {
    folderIds.add(folderId)
  }
  for (const dossierId of collected.dossierIds) {
    dossierIds.add(dossierId)
  }
}

async function loadFolderBranchForOcrWatch(
  folderId: string,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
  folderIds: Set<string>,
  dossierIds: Set<string>,
  loadedFolderIds: Set<string>,
): Promise<void> {
  if (loadedFolderIds.has(folderId)) return
  loadedFolderIds.add(folderId)

  let loadedTree: DataTreeNodeT
  try {
    loadedTree = await loadNodeChildren(folderId)
  } catch {
    return
  }

  mergeOcrRoomIdsFromTree(loadedTree, folderIds, dossierIds)
  if (folderId !== DATA_TREE_ROOT_ID) {
    folderIds.add(folderId)
  }

  const folderNode = findNodeInTree(loadedTree, folderId)
  if (!folderNode) return

  for (const child of folderNode.children) {
    if (child.type !== 'folder' || child.id === DATA_TREE_ROOT_ID) continue
    await loadFolderBranchForOcrWatch(
      child.id,
      loadNodeChildren,
      folderIds,
      dossierIds,
      loadedFolderIds,
    )
  }
}

/** Load folder branches and collect socket room ids for OCR in progress. */
export async function discoverOcrWatchTargets(
  tree: DataTreeNodeT,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<{ folderIds: Array<string>; dossierIds: Array<string> }> {
  const folderIds = new Set<string>()
  const dossierIds = new Set<string>()
  const loadedFolderIds = new Set<string>()

  mergeOcrRoomIdsFromTree(tree, folderIds, dossierIds)

  for (const topFolder of tree.children) {
    if (topFolder.type !== 'folder') continue
    await loadFolderBranchForOcrWatch(
      topFolder.id,
      loadNodeChildren,
      folderIds,
      dossierIds,
      loadedFolderIds,
    )
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

export async function resolveDossierIdFromStorageKey(
  tree: DataTreeNodeT,
  storageKey: string,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<string | null> {
  const { anchorSegment, parentSegments, fileName } =
    parseStorageKeyFileRef(storageKey)
  if (!anchorSegment || !fileName) return null

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

  if (currentNode.children.length === 0) {
    try {
      const loadedTree = await loadNodeChildren(currentNode.id)
      currentNode = findNodeInTree(loadedTree, currentNode.id) ?? currentNode
    } catch {
      return null
    }
  }

  return resolveDossierIdFromNode(currentNode, storageKey, fileName)
}

export async function resolveDossierIdsForUploadConflicts(
  conflicts: Array<UploadPathConflict>,
  tree: DataTreeNodeT,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<Map<string, string>> {
  const resolved = await mapWithConcurrency(
    conflicts,
    DOSSIER_RESOLVE_CONCURRENCY,
    async (conflict) => {
      const dossierId = await resolveDossierIdFromStorageKey(
        tree,
        conflict.storageKey,
        loadNodeChildren,
      )
      return dossierId
        ? ({ storageKey: conflict.storageKey, dossierId } as const)
        : null
    },
  )

  const map = new Map<string, string>()
  for (const item of resolved) {
    if (item) map.set(item.storageKey, item.dossierId)
  }
  return map
}
