import { apiClient } from '@/lib/api/apiClient'
import { classifyFolderTypes } from '@/features/data-management/lib/treeClassifier'
import { validateNoMixedRecordFolder } from '@/features/data-management/lib/treeValidator'
import {
  buildParsedTreeFromFiles,
  getUploadTreeRoot,
  hasInvalidUploadFiles,
  parsedTreeToDataNodes,
} from '@/features/data-management/lib/uploadParser'
import {
  ASSIGN_FOLDER_ROLE,
  DATA_TREE_ROOT_ID,
} from '@/features/data-management/lib/constants'
import {
  buildDossierRecordContent,
  fetchDossierMetadata,
  fetchMetadataGroups,
  mapFileToDocumentNode,
  resolveMetadataUrl,
} from '@/features/data-management/lib/metadataHelpers'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import type {
  DataFolderEntityType,
  DataRecordStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'
import type { UploadFolderResult, UploadProgress } from '@/features/data-management/api/dossierClient'
import { uploadFolderFiles } from '@/features/data-management/api/dossierClient'

let dynamicTree: DataTreeNodeT | null = null
const loadedNodes = new Set<string>()
let currentFetchRole: DataManagementRole = 'admin'

const ASSIGNMENT_API_ROLE: Record<'qc' | 'editor', string> = {
  qc: 'CHECKER_1',
  editor: 'EDITOR',
}

function findNode(node: DataTreeNodeT, id: string): DataTreeNodeT | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

function cloneTree(root: DataTreeNodeT): DataTreeNodeT {
  return structuredClone(root)
}

function recomputeFolderSizes(node: DataTreeNodeT): DataTreeNodeT {
  if (node.type === 'document') {
    return node
  }
  const children = node.children.map(recomputeFolderSizes)
  const sizeBytes = children.reduce((sum, child) => sum + child.sizeBytes, 0)
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

function createEmptyRoot(): DataTreeNodeT {
  return {
    id: DATA_TREE_ROOT_ID,
    name: 'Root',
    type: 'folder',
    parentId: null,
    children: [],
    sizeBytes: 0,
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'System',
  }
}

function requireDynamicTree(): DataTreeNodeT {
  if (!dynamicTree) {
    throw new Error('Data tree is not loaded')
  }
  return dynamicTree
}

function resetTreeCache(role: DataManagementRole) {
  currentFetchRole = role
  dynamicTree = null
  loadedNodes.clear()
}

function extractDossierId(
  source: Record<string, unknown>,
): string | undefined {
  if (source.dossierId != null) return String(source.dossierId)
  if (source.dossier_id != null) return String(source.dossier_id)
  const dossier = source.dossier
  if (dossier && typeof dossier === 'object' && (dossier as Record<string, unknown>).id != null) {
    return String((dossier as Record<string, unknown>).id)
  }
  return undefined
}

function extractDossierFolderId(
  source: Record<string, unknown>,
): string | undefined {
  if (source.folderId != null) return String(source.folderId)
  if (source.folder_id != null) return String(source.folder_id)
  const folder = source.folder
  if (folder && typeof folder === 'object' && (folder as Record<string, unknown>).id != null) {
    return String((folder as Record<string, unknown>).id)
  }
  return undefined
}

function parseEntityType(value: unknown): DataFolderEntityType | undefined {
  if (value === 'DOCUMENT' || value === 'FOLDER') return value
  return undefined
}

function extractRequiredQcCount(
  source: Record<string, unknown>,
): number | undefined {
  const value = source.requiredQcCount ?? source.required_qc_count
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined
}

function applyDossierFields(
  node: DataTreeNodeT,
  source: Record<string, unknown>,
): void {
  const dossierId = extractDossierId(source)
  if (dossierId) node.dossierId = dossierId
  const folderId = extractDossierFolderId(source)
  if (folderId) node.folderId = folderId
  const requiredQcCount = extractRequiredQcCount(source)
  if (requiredQcCount != null) node.requiredQcCount = requiredQcCount
  if (source.name != null && String(source.name).trim()) {
    node.name = String(source.name)
  }
}

function mapFolderChild(child: Record<string, unknown>): DataTreeNodeT {
  const entityType = parseEntityType(child.entityType)
  const folderId = extractDossierFolderId(child)
  const dossierId = extractDossierId(child)
  const requiredQcCount = extractRequiredQcCount(child)

  return {
    id: String(child.id),
    name: String(child.folderName || child.name),
    type: 'folder',
    parentId: child.parentId != null ? String(child.parentId) : null,
    children: [],
    sizeBytes: 0,
    uploadedAt: String(child.createdAt || new Date().toISOString()),
    uploadedBy: 'System',
    ...(entityType ? { entityType } : {}),
    ...(dossierId ? { dossierId } : {}),
    ...(folderId ? { folderId } : {}),
    ...(requiredQcCount != null ? { requiredQcCount } : {}),
  }
}

async function buildAdminRootTree(): Promise<DataTreeNodeT> {
  const res = await apiClient.get<{ children?: Array<Record<string, unknown>> }>(
    '/api/v1/folders/all-parent',
  )
  const data = res.data
  const children = (data.children || []).map(mapFolderChild)

  const root = createEmptyRoot()
  root.children = children
  loadedNodes.add(DATA_TREE_ROOT_ID)
  return root
}

async function buildAssignmentTree(role: 'qc' | 'editor'): Promise<DataTreeNodeT> {
  const apiRole = ASSIGNMENT_API_ROLE[role]
  const res = await apiClient.get<{
    assignments?: Array<{
      dossier?: Record<string, unknown>
    }>
  }>('/api/v1/dossiers/assignments/by-role', {
    params: { role: apiRole },
  })

  const assignments = res.data.assignments || []
  const rootNode = createEmptyRoot()
  const nodesMap = new Map<string, DataTreeNodeT>()
  nodesMap.set(DATA_TREE_ROOT_ID, rootNode)

  for (const assignment of assignments) {
    const dossier = assignment.dossier
    if (!dossier || !dossier.folderPath) continue

    let path = String(dossier.folderPath)
    if (path.startsWith('raw/')) {
      path = path.slice(4)
    }

    const segments = path.split('/').filter(Boolean)
    let currentParentId = DATA_TREE_ROOT_ID

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      const isLast = index === segments.length - 1
      const nodePath = segments.slice(0, index + 1).join('/')
      const dossierId = String(dossier.id)
      const nodeId = isLast ? dossierId : `${role}-node-${nodePath}`

      if (!nodesMap.has(nodeId)) {
        const newNode: DataTreeNodeT = {
          id: nodeId,
          name: segment,
          type: isLast ? 'record' : 'folder',
          parentId: currentParentId,
          children: [],
          sizeBytes: 0,
          uploadedAt: String(dossier.updatedAt || new Date().toISOString()),
          uploadedBy: 'System',
        }

        if (isLast) {
          newNode.recordStatus = 'pendingOcr'
          newNode.entityType = 'DOCUMENT'
          newNode.dossierId = dossierId
          applyDossierFields(newNode, dossier)
          const recordContent = await buildDossierRecordContent(
            dossierId,
            dossier,
          )
          newNode.children = recordContent.children
          newNode.dossierMetadata = recordContent.dossierMetadata
          loadedNodes.add(dossierId)
        }

        nodesMap.set(nodeId, newNode)
        const parent = nodesMap.get(currentParentId)
        if (parent) {
          parent.children.push(newNode)
        }
      }

      currentParentId = nodeId
    }
  }

  loadedNodes.add(DATA_TREE_ROOT_ID)
  return rootNode
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

export async function getDataTree(
  role: DataManagementRole = 'admin',
): Promise<DataTreeNodeT> {
  if (!dynamicTree || currentFetchRole !== role) {
    resetTreeCache(role)

    if (role === 'qc' || role === 'editor') {
      dynamicTree = await buildAssignmentTree(role)
    } else {
      dynamicTree = await buildAdminRootTree()
    }
  }

  return cloneTree(dynamicTree)
}

export async function loadNodeChildren(
  nodeId: string,
  role: DataManagementRole = 'admin',
): Promise<DataTreeNodeT> {
  if (!dynamicTree) {
    throw new Error('Data tree is not loaded')
  }

  if (role === 'qc' || role === 'editor') {
    loadedNodes.add(nodeId)
    return cloneTree(dynamicTree)
  }

  if (loadedNodes.has(nodeId)) {
    return cloneTree(dynamicTree)
  }

  const node = findNode(dynamicTree, nodeId)
  if (!node || node.type !== 'folder') {
    return cloneTree(dynamicTree)
  }

  const res = await apiClient.get<Record<string, unknown>>(
    `/api/v1/folders/${nodeId}/all-first-subfolders`,
  )
  const data = res.data

  if (data.nodeType === 'folder') {
    node.children = (Array.isArray(data.children) ? data.children : []).map(
      (child) => mapFolderChild(child as Record<string, unknown>),
    )
  } else if (data.nodeType === 'dossier') {
    const dossiers = Array.isArray(data.children) ? data.children : []
    const allFiles: Array<DataTreeNodeT> = []
    let dossierMetadata

    for (const dossier of dossiers) {
      const dossierRecord = dossier as Record<string, unknown>
      if (!node.dossierId && dossierRecord.id != null) {
        node.dossierId = String(dossierRecord.id)
      }
      const recordContent = await buildDossierRecordContent(
        String(dossierRecord.id),
        dossierRecord,
      )
      allFiles.push(...recordContent.children)
      dossierMetadata = recordContent.dossierMetadata ?? dossierMetadata
    }

    node.children = allFiles
    node.type = 'record'
    node.entityType = 'DOCUMENT'
    node.folderId = nodeId
    applyDossierFields(node, data)
    node.folderId = nodeId
    node.recordStatus = 'pendingOcr'
    node.dossierMetadata = dossierMetadata
  } else if (data.nodeType === 'file') {
    const metaUrl = resolveMetadataUrl(data)
    const [metadataGroups, dossierMetadata] = await Promise.all([
      fetchMetadataGroups(metaUrl),
      fetchDossierMetadata(metaUrl),
    ])
    const children = Array.isArray(data.children) ? data.children : []

    node.children = children.map((child) =>
      mapFileToDocumentNode(
        child as Record<string, unknown>,
        nodeId,
        metadataGroups,
      ),
    )
    node.type = 'record'
    node.entityType = 'DOCUMENT'
    node.folderId = nodeId
    applyDossierFields(node, data)
    node.folderId = nodeId
    node.recordStatus = 'pendingOcr'
    node.dossierMetadata = dossierMetadata
  }

  loadedNodes.add(nodeId)
  return cloneTree(dynamicTree)
}

export async function uploadDataFolder(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadFolderResult> {
  if (files.length === 0) {
    throw new DataManagementUploadError('invalidFile')
  }

  if (hasInvalidUploadFiles(files)) {
    throw new DataManagementUploadError('invalidFile')
  }

  const parsed = buildParsedTreeFromFiles(files)
  const rootParsed = getUploadTreeRoot(parsed)
  const uploadedAt = new Date().toISOString()
  const uploadedBy = 'System'

  let built = parsedTreeToDataNodes(rootParsed, { uploadedBy, uploadedAt })
  built = classifyFolderTypes(built)

  const validation = validateNoMixedRecordFolder(built)
  if (validation !== true) {
    throw new DataManagementUploadError(validation.code)
  }

  return uploadFolderFiles(files, onProgress)
}

export async function renameDataNode(
  id: string,
  name: string,
): Promise<DataTreeNodeT> {
  const tree = requireDynamicTree()
  dynamicTree = mapTree(tree, (node) =>
    node.id === id ? { ...node, name } : node,
  )
  return cloneTree(dynamicTree)
}

export async function deleteDataNode(id: string): Promise<DataTreeNodeT> {
  const tree = requireDynamicTree()
  if (id === DATA_TREE_ROOT_ID) {
    return cloneTree(tree)
  }
  dynamicTree = recomputeFolderSizes(removeNode(tree, id))
  return cloneTree(dynamicTree)
}

export async function addDataDocument(
  parentId: string,
): Promise<DataTreeNodeT> {
  const tree = requireDynamicTree()
  const createdAt = new Date().toISOString()
  const document: DataTreeNodeT = {
    id: `dm-doc-${crypto.randomUUID()}`,
    name: 'document.pdf',
    type: 'document',
    parentId,
    children: [],
    sizeBytes: 0,
    uploadedAt: createdAt,
    uploadedBy: 'System',
    mimeType: 'application/pdf',
  }

  dynamicTree = recomputeFolderSizes(
    mapTree(tree, (node) => {
      if (node.id !== parentId) return node
      return {
        ...node,
        type: 'record',
        recordStatus: node.recordStatus ?? 'pendingOcr',
        children: [...node.children, document],
      }
    }),
  )

  return cloneTree(dynamicTree)
}

export async function addDataFolder(parentId: string): Promise<DataTreeNodeT> {
  const tree = requireDynamicTree()
  const createdAt = new Date().toISOString()
  const folder: DataTreeNodeT = {
    id: `dm-folder-${crypto.randomUUID()}`,
    name: 'folder',
    type: 'folder',
    parentId,
    children: [],
    sizeBytes: 0,
    uploadedAt: createdAt,
    uploadedBy: 'System',
  }

  dynamicTree = mapTree(tree, (node) =>
    node.id === parentId
      ? { ...node, children: [...node.children, folder] }
      : node,
  )

  return cloneTree(dynamicTree)
}

/** Update dossier — PUT /api/v1/dossiers/:id */
export async function updateDossier({
  id,
  name,
  requiredQcCount,
}: {
  id: string
  name?: string
  requiredQcCount?: number
}): Promise<void> {
  const body: Record<string, string | number> = {}
  if (name !== undefined) body.name = name
  if (requiredQcCount !== undefined) body.requiredQcCount = requiredQcCount
  await apiClient.put(`/api/v1/dossiers/${id}`, body)
}

/** QC assignment — POST /api/v1/dossiers/assign-by-folder */
export async function assignDataRecord({
  folderId,
  assigneeId,
  role,
}: {
  folderId: string
  assigneeId: string
  role: string
}): Promise<void> {
  await apiClient.post('/api/v1/dossiers/assign-by-folder', {
    folderId,
    assigneeId,
    role,
  })
}

/** Editor assignment — POST /api/v1/dossiers/:id/assign */
export async function assignDossierEditor({
  dossierFolderId,
  assigneeId,
}: {
  dossierFolderId: string
  assigneeId: string
}): Promise<void> {
  await apiClient.post(`/api/v1/dossiers/${dossierFolderId}/assign`, {
    assigneeId,
    role: ASSIGN_FOLDER_ROLE.maker,
  })
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
