import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import { findNodeById } from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'

/**
 * Returns true if a node has any child folders/records (i.e. is a parent folder).
 */
export function isParentFolderNode(node: DataTreeNodeT): boolean {
  return node.children.some((child) => child.type !== 'document')
}

/**
 * Collect all leaf folder IDs under a given node (folders that have no child folders/records).
 * If the node itself has no child folders/records, returns [node.id].
 */
export function getLeafFolderIds(node: DataTreeNodeT): Array<string> {
  const leafIds: Array<string> = []
  function walk(curr: DataTreeNodeT) {
    const folderChildren = curr.children.filter((c) => c.type !== 'document')
    if (folderChildren.length === 0) {
      if (curr.id !== DATA_TREE_ROOT_ID) {
        leafIds.push(curr.id)
      }
    } else {
      for (const child of folderChildren) {
        walk(child)
      }
    }
  }
  walk(node)
  return leafIds
}

/**
 * Compute the tri-state checked state of a folder node:
 * - If the node has child folders:
 *   - true: ALL leaf folder descendants are in selectedSet.
 *   - 'indeterminate': SOME (but not all) leaf folder descendants are in selectedSet.
 *   - false: NO leaf folder descendants are in selectedSet.
 * - If the node has no child folders (leaf folder):
 *   - true: selectedSet.has(node.id).
 *   - false: !selectedSet.has(node.id).
 */
export function computeFolderCheckedState(
  node: DataTreeNodeT,
  selectedSet: Set<string>,
): boolean | 'indeterminate' {
  const folderChildren = node.children.filter((c) => c.type !== 'document')

  if (folderChildren.length === 0) {
    return selectedSet.has(node.id)
  }

  let checkedCount = 0
  let indeterminateCount = 0

  for (const child of folderChildren) {
    const childState = computeFolderCheckedState(child, selectedSet)
    if (childState === true) {
      checkedCount++
    } else if (childState === 'indeterminate') {
      indeterminateCount++
    }
  }

  if (checkedCount === folderChildren.length) {
    return true
  }
  if (checkedCount > 0 || indeterminateCount > 0) {
    return 'indeterminate'
  }
  return false
}

/**
 * Toggle a folder node:
 * - If currently checked (true): uncheck all leaf subfolders under it.
 * - If currently unchecked or indeterminate: select all leaf subfolders under it,
 *   WITHOUT adding the parent folder itself to selectedFolderIds.
 */
export function toggleFolderWithDescendants(
  tree: DataTreeNodeT,
  folderId: string,
  currentSelectedIds: Array<string>,
): Array<string> {
  const targetNode = findNodeById(tree, folderId)
  if (!targetNode) return currentSelectedIds

  const selectedSet = new Set(currentSelectedIds)
  const currentState = computeFolderCheckedState(targetNode, selectedSet)
  const leafIds = getLeafFolderIds(targetNode)

  if (currentState === true) {
    // Uncheck all leaf subfolders under target
    const toRemove = new Set(leafIds)
    toRemove.add(targetNode.id)
    return currentSelectedIds.filter((id) => !toRemove.has(id))
  } else {
    // Select all leaf subfolders under target, NEVER the parent folder if it has subfolders
    const nextSet = new Set(currentSelectedIds)
    if (isParentFolderNode(targetNode)) {
      nextSet.delete(targetNode.id)
    }
    for (const id of leafIds) {
      nextSet.add(id)
    }
    return Array.from(nextSet)
  }
}

/**
 * When tree nodes load dynamically (lazy load), if a parent folder was previously selected
 * (when its children were not yet loaded into memory), replace the parent folder with its
 * newly loaded leaf subfolders so the parent folder is not assigned.
 */
export function syncLoadedDescendantsOfSelectedFolders(
  tree: DataTreeNodeT,
  currentSelectedIds: Array<string>,
): Array<string> {
  if (currentSelectedIds.length === 0) return currentSelectedIds
  const selectedSet = new Set(currentSelectedIds)
  let changed = false
  const nextSet = new Set(currentSelectedIds)

  function walk(node: DataTreeNodeT, isAncestorSelected: boolean) {
    const isNodeSelected = selectedSet.has(node.id)
    const effectiveSelected = isAncestorSelected || isNodeSelected
    const isParent = isParentFolderNode(node)

    // If this node is a parent folder and is in selectedSet, remove it!
    if (isParent && nextSet.has(node.id)) {
      nextSet.delete(node.id)
      changed = true
    }

    // If this node or an ancestor was selected, and this is a leaf node, add it!
    if (
      effectiveSelected &&
      !isParent &&
      node.id !== DATA_TREE_ROOT_ID &&
      node.id !== tree.id
    ) {
      if (!nextSet.has(node.id)) {
        nextSet.add(node.id)
        changed = true
      }
    }

    for (const child of node.children) {
      if (child.type !== 'document') {
        walk(child, effectiveSelected)
      }
    }
  }

  for (const rootChild of tree.children) {
    walk(rootChild, false)
  }

  return changed ? Array.from(nextSet) : currentSelectedIds
}
