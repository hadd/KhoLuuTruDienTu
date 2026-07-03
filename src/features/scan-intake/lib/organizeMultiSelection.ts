import { collectPdfsUnderFolder } from '@/features/scan-intake/lib/collectOrganizePdfs'
import type { OrganizeTreeNode } from '@/features/scan-intake/lib/organizeFolderTree'

export type OrganizeMultiSelection =
  | { type: 'pdf'; keys: Set<string> }
  | { type: 'folder'; paths: Set<string> }
  | null

export function collectAllFolderPaths(nodes: Array<OrganizeTreeNode>): Array<string> {
  const paths: Array<string> = []
  function walk(node: OrganizeTreeNode) {
    paths.push(node.path)
    for (const child of node.children) walk(child)
  }
  for (const node of nodes) walk(node)
  return paths
}

export function collectPromotePdfKeys(
  selection: OrganizeMultiSelection,
  tree: Array<OrganizeTreeNode>,
): Array<string> {
  if (!selection) return []
  if (selection.type === 'pdf') {
    return [...selection.keys]
  }
  const keys = new Set<string>()
  for (const folderPath of selection.paths) {
    for (const key of collectPdfsUnderFolder(tree, folderPath)) {
      keys.add(key)
    }
  }
  return [...keys]
}

export function isPdfChecked(
  selection: OrganizeMultiSelection,
  key: string,
): boolean {
  return selection?.type === 'pdf' && selection.keys.has(key)
}

export function isFolderChecked(
  selection: OrganizeMultiSelection,
  path: string,
): boolean {
  return selection?.type === 'folder' && selection.paths.has(path)
}

export function togglePdfSelection(
  selection: OrganizeMultiSelection,
  key: string,
): OrganizeMultiSelection {
  if (selection?.type === 'folder') return selection
  const keys = new Set(selection?.type === 'pdf' ? selection.keys : [])
  if (keys.has(key)) keys.delete(key)
  else keys.add(key)
  return keys.size > 0 ? { type: 'pdf', keys } : null
}

export function toggleFolderSelection(
  selection: OrganizeMultiSelection,
  path: string,
): OrganizeMultiSelection {
  if (selection?.type === 'pdf') return selection
  const paths = new Set(selection?.type === 'folder' ? selection.paths : [])
  if (paths.has(path)) paths.delete(path)
  else paths.add(path)
  return paths.size > 0 ? { type: 'folder', paths } : null
}

export function selectAllPdfs(keys: Array<string>): OrganizeMultiSelection {
  if (keys.length === 0) return null
  return { type: 'pdf', keys: new Set(keys) }
}

export function selectAllFolders(paths: Array<string>): OrganizeMultiSelection {
  if (paths.length === 0) return null
  return { type: 'folder', paths: new Set(paths) }
}

export function isAllPdfsSelected(
  selection: OrganizeMultiSelection,
  keys: Array<string>,
): boolean {
  if (keys.length === 0) return false
  return (
    selection?.type === 'pdf' &&
    keys.every((key) => selection.keys.has(key))
  )
}

export function isAllFoldersSelected(
  selection: OrganizeMultiSelection,
  paths: Array<string>,
): boolean {
  if (paths.length === 0) return false
  return (
    selection?.type === 'folder' &&
    paths.every((path) => selection.paths.has(path))
  )
}
