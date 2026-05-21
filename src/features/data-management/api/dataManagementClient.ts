import {
  createSeedDataTree,
  MOCK_DATA_ASSIGNEES,
  MOCK_DATA_ROOT_ID,
} from '@/features/data-management/lib/mockData'
import { classifyFolderTypes } from '@/features/data-management/lib/treeClassifier'
import { validateNoMixedRecordFolder } from '@/features/data-management/lib/treeValidator'
import {
  buildParsedTreeFromFiles,
  getUploadTreeRoot,
  hasInvalidUploadFiles,
  parsedTreeToDataNodes,
} from '@/features/data-management/lib/uploadParser'
import type {
  DataAssigneeT,
  DataRecordStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'

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

function mapTree(
  node: DataTreeNodeT,
  mapper: (node: DataTreeNodeT) => DataTreeNodeT,
): DataTreeNodeT {
  const mapped = mapper(node)
  return {
    ...mapped,
    children: mapped.children.map((child) => mapTree(child, mapper)),
  }
}

function removeNode(root: DataTreeNodeT, id: string): DataTreeNodeT {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== id)
      .map((child) => removeNode(child, id)),
  }
}

function createMockDocument(parentId: string): DataTreeNodeT {
  const createdAt = new Date().toISOString()
  return {
    id: `dm-doc-${crypto.randomUUID()}`,
    name: 'Tài liệu mới.pdf',
    type: 'document',
    parentId,
    children: [],
    sizeBytes: 64_000,
    uploadedAt: createdAt,
    uploadedBy: 'Admin Demo',
    mimeType: 'application/pdf',
    fileUrl: '/mock-data-preview.pdf',
  }
}

function createMockFolder(parentId: string): DataTreeNodeT {
  const createdAt = new Date().toISOString()
  return {
    id: `dm-folder-${crypto.randomUUID()}`,
    name: 'Thư mục mới',
    type: 'folder',
    parentId,
    children: [],
    sizeBytes: 0,
    uploadedAt: createdAt,
    uploadedBy: 'Admin Demo',
  }
}

function findAssignee(id: string): DataAssigneeT {
  return (
    MOCK_DATA_ASSIGNEES.find((assignee) => assignee.id === id) ??
    MOCK_DATA_ASSIGNEES[0]
  )
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

export async function getDataTree(role: string = 'admin'): Promise<DataTreeNodeT> {
  await delay(120)
  return cloneTree(mockTree)
}

export async function uploadDataFolder(
  files: Array<File>,
): Promise<DataTreeNodeT> {
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

export async function renameDataNode(
  id: string,
  name: string,
): Promise<DataTreeNodeT> {
  await delay(120)
  mockTree = mapTree(mockTree, (node) =>
    node.id === id ? { ...node, name } : node,
  )
  return cloneTree(mockTree)
}

export async function deleteDataNode(id: string): Promise<DataTreeNodeT> {
  await delay(120)
  if (id === MOCK_DATA_ROOT_ID) return cloneTree(mockTree)
  mockTree = recomputeFolderSizes(removeNode(mockTree, id))
  return cloneTree(mockTree)
}

export async function addDataDocument(
  parentId: string,
): Promise<DataTreeNodeT> {
  await delay(120)
  const document = createMockDocument(parentId)
  mockTree = recomputeFolderSizes(
    mapTree(mockTree, (node) => {
      if (node.id !== parentId) return node
      return {
        ...node,
        type: 'record',
        recordStatus: node.recordStatus ?? 'pendingOcr',
        children: [...node.children, document],
      }
    }),
  )
  return cloneTree(mockTree)
}

export async function addDataFolder(parentId: string): Promise<DataTreeNodeT> {
  await delay(120)
  const folder = createMockFolder(parentId)
  mockTree = mapTree(mockTree, (node) =>
    node.id === parentId
      ? { ...node, children: [...node.children, folder] }
      : node,
  )
  return cloneTree(mockTree)
}

export async function assignDataRecord({
  id,
  assigneeId,
  target,
}: {
  id: string
  assigneeId: string
  target: 'editor' | 'reviewer1' | 'reviewer2' | 'reviewer3'
}): Promise<DataTreeNodeT> {
  await delay(120)
  const assignee = findAssignee(assigneeId)
  mockTree = mapTree(mockTree, (node) => {
    if (node.id !== id) return node
    return { ...node, [target]: assignee }
  })
  return cloneTree(mockTree)
}

export function getMockDataAssignees(): Array<DataAssigneeT> {
  return MOCK_DATA_ASSIGNEES
}

export function getRecordAssignmentTarget(
  status: DataRecordStatus | undefined,
): 'editor' | 'reviewer1' | 'reviewer2' | 'reviewer3' | null {
  if (status === 'pendingOcr') return 'editor'
  if (status === 'edited') return 'reviewer1'
  if (status === 'pendingApproval' || status === 'approved1') return 'reviewer2'
  if (status === 'approved2' || status === 'final') return 'reviewer3'
  return null
}

/** Test / reset helper */
export function resetDataManagementMockTree() {
  mockTree = createSeedDataTree()
}
