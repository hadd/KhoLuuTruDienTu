import type { OrganizeTreeNode } from '@/features/scan-intake/lib/organizeFolderTree'

export function collectPdfsUnderFolder(
  nodes: Array<OrganizeTreeNode>,
  folderPath: string,
): Array<string> {
  const keys: Array<string> = []

  function walk(node: OrganizeTreeNode) {
    if (node.path === folderPath || node.path.startsWith(`${folderPath}/`)) {
      for (const pdf of node.pdfs) keys.push(pdf.key)
    }
    for (const child of node.children) walk(child)
  }

  for (const node of nodes) walk(node)
  return keys
}

export function findFolderNode(
  nodes: Array<OrganizeTreeNode>,
  folderPath: string,
): OrganizeTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === folderPath) return node
    const found = findFolderNode(node.children, folderPath)
    if (found) return found
  }
  return undefined
}
