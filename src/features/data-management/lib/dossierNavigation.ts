import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import {
  findNodeByDossierId,
  findNodeById,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'

export interface ResolveDossierNodeResultT {
  tree: DataTreeNodeT
  node: DataTreeNodeT
}

/** Breadth-first load folder listings until a dossier node appears in the tree. */
export async function resolveDossierNodeInTree(
  tree: DataTreeNodeT,
  dossierId: string,
  loadNodeChildren: (nodeId: string) => Promise<DataTreeNodeT>,
): Promise<ResolveDossierNodeResultT | null> {
  const trimmedDossierId = dossierId.trim()
  if (!trimmedDossierId) return null

  let currentTree = tree
  let node = findNodeByDossierId(currentTree, trimmedDossierId)
  if (node) {
    return { tree: currentTree, node }
  }

  const loadedFolderIds = new Set<string>()
  let pendingFolderIds = currentTree.children
    .filter((child) => child.type === 'folder')
    .map((child) => child.id)

  while (pendingFolderIds.length > 0) {
    const nextLevelFolderIds = new Set<string>()

    for (const folderId of pendingFolderIds) {
      if (loadedFolderIds.has(folderId)) continue
      loadedFolderIds.add(folderId)

      try {
        currentTree = await loadNodeChildren(folderId)
      } catch {
        continue
      }

      node = findNodeByDossierId(currentTree, trimmedDossierId)
      if (node) {
        return { tree: currentTree, node }
      }

      const folderNode = findNodeById(currentTree, folderId)
      if (!folderNode) continue

      for (const child of folderNode.children) {
        if (child.type === 'folder' && child.id !== DATA_TREE_ROOT_ID) {
          nextLevelFolderIds.add(child.id)
        }
      }
    }

    pendingFolderIds = [...nextLevelFolderIds]
  }

  return null
}
