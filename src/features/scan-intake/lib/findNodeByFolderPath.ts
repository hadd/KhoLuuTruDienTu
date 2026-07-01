import type { DataTreeNodeT } from '@/features/data-management/types'

export function findNodeByFolderPath(
  root: DataTreeNodeT,
  folderPath: string,
): DataTreeNodeT | null {
  if (root.folderPath === folderPath) return root
  for (const child of root.children) {
    const found = findNodeByFolderPath(child, folderPath)
    if (found) return found
  }
  return null
}

export function resolvePromoteTargetFolderPath(
  node: DataTreeNodeT,
): string | undefined {
  if (node.type === 'document') return undefined
  const path = node.folderPath?.trim()
  return path || undefined
}
