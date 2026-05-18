import { createSeedDataTree,MOCK_DATA_ROOT_ID } from '@/features/data-management/lib/mockData'
import { classifyFolderTypes } from '@/features/data-management/lib/treeClassifier'
import { validateNoMixedRecordFolder } from '@/features/data-management/lib/treeValidator'
import {
  buildParsedTreeFromFiles,
  getUploadTreeRoot,
  hasInvalidUploadFiles,
  parsedTreeToDataNodes,
} from '@/features/data-management/lib/uploadParser'
import type { DataTreeNodeT } from '@/features/data-management/types'

/**
 * In-memory tree for admin data management (mock).
 * Replace with `apiClient` when backend exists:
 * - GET `/api/v1/admin/data/tree`
 * - POST `/api/v1/admin/data/upload` (multipart)
 */
let mockTree: DataTreeNodeT = createSeedDataTree()

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cloneTree(root: DataTreeNodeT): DataTreeNodeT {
  return structuredClone(root)
}

function recomputeFolderSizes(node: DataTreeNodeT): DataTreeNodeT {
  if (node.type === 'document') {
    return node
  }
  const children = node.children.map(recomputeFolderSizes)
  const sizeBytes = children.reduce((s, c) => s + c.sizeBytes, 0)
  return { ...node, children, sizeBytes }
}

export class DataManagementUploadError extends Error {
  constructor(
    public readonly code: 'mixedFolder' | 'invalidFile',
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'DataManagementUploadError'
  }
}

export async function getDataTree(): Promise<DataTreeNodeT> {
  await delay(120)
  return cloneTree(mockTree)
}

export async function uploadDataFolder(files: Array<File>): Promise<DataTreeNodeT> {
  await delay(200)

  if (files.length === 0) {
    throw new DataManagementUploadError('invalidFile')
  }

  if (hasInvalidUploadFiles(files)) {
    throw new DataManagementUploadError('invalidFile')
  }

  const parsed = buildParsedTreeFromFiles(files)
  const rootParsed = getUploadTreeRoot(parsed)
  const uploadedAt = new Date().toISOString()
  const uploadedBy = 'Admin Demo'

  let built = parsedTreeToDataNodes(rootParsed, { uploadedBy, uploadedAt })
  built = classifyFolderTypes(built)

  const validation = validateNoMixedRecordFolder(built)
  if (validation !== true) {
    throw new DataManagementUploadError(validation.code)
  }

  const root = mockTree
  const attached: DataTreeNodeT = {
    ...built,
    parentId: MOCK_DATA_ROOT_ID,
  }

  mockTree = recomputeFolderSizes({
    ...root,
    children: [...root.children, attached],
  })

  return cloneTree(mockTree)
}

/** Test / reset helper */
export function resetDataManagementMockTree() {
  mockTree = createSeedDataTree()
}
