import type { DataTreeNodeT } from '@/features/data-management/types'

export type TreeValidationErrorCode = 'mixedFolder'

export function validateNoMixedRecordFolder(
  node: DataTreeNodeT,
): true | { code: TreeValidationErrorCode } {
  function visit(n: DataTreeNodeT): true | { code: TreeValidationErrorCode } {
    if (n.type === 'document') {
      return true
    }

    const directPdfs = n.children.filter((c) => c.type === 'document')
    const nestedRecords = n.children.filter((c) => c.type === 'record')
    if (directPdfs.length > 0 && nestedRecords.length > 0) {
      return { code: 'mixedFolder' }
    }

    for (const c of n.children) {
      const r = visit(c)
      if (r !== true) return r
    }
    return true
  }

  return visit(node)
}
