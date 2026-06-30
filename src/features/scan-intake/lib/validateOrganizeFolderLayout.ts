import type { OrganizeTreeNode } from '@/features/scan-intake/lib/organizeFolderTree'

export type OrganizeLayoutErrorCode = 'mixedFolder'

export function validateNoMixedOrganizeFolder(
  nodes: Array<OrganizeTreeNode>,
): true | { code: OrganizeLayoutErrorCode; folderPath: string } {
  function visit(
    node: OrganizeTreeNode,
  ): true | { code: OrganizeLayoutErrorCode; folderPath: string } {
    if (node.pdfs.length > 0 && node.children.length > 0) {
      return { code: 'mixedFolder', folderPath: node.path }
    }

    for (const child of node.children) {
      const result = visit(child)
      if (result !== true) return result
    }

    return true
  }

  for (const node of nodes) {
    const result = visit(node)
    if (result !== true) return result
  }

  return true
}
