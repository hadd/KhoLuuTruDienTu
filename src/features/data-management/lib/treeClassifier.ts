import type { DataTreeNodeT } from '@/features/data-management/types'

/**
 * After upload parsing, folders are `folder` until classified.
 * A folder becomes `record` if it has a PDF (document) anywhere under it.
 */
export function classifyFolderTypes(node: DataTreeNodeT): DataTreeNodeT {
  function post(n: DataTreeNodeT): DataTreeNodeT {
    if (n.type === 'document') {
      return { ...n, children: [] }
    }

    const kids = n.children.map(post)
    const hasPdf = kids.some(
      (c) => c.type === 'document' || c.type === 'record',
    )
    const sizeBytes = kids.reduce((s, c) => s + c.sizeBytes, 0)

    return {
      ...n,
      type: hasPdf ? 'record' : 'folder',
      children: kids,
      sizeBytes,
    }
  }

  return post(node)
}
