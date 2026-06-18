import { claimMakerAssignment } from '@/features/data-management/api/dataEntryClient'
import type {
  UploadFolderOptions,
  UploadFolderResult,
  UploadProgress,
} from '@/features/data-management/api/dossierClient'
import { uploadFolderFiles } from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import {
  ASSIGN_FOLDER_ROLE,
  DATA_TREE_ROOT_ID,
} from '@/features/data-management/lib/constants'
import {
  dedupeDossierMetadataMergeArtifacts,
  buildDossierRecordContent,
  fetchDossierMetadata,
  fetchMetadataGroups,
  mapFileToDocumentNode,
  resolveClaimMetadata,
  resolveMetadataUrl,
  sizeKbToBytes,
} from '@/features/data-management/lib/metadataHelpers'
import { classifyFolderTypes } from '@/features/data-management/lib/treeClassifier'
import {
  mergeListingChildren,
  type DossierFolderTarget,
} from '@/features/data-management/lib/treeUtils'
import { validateNoMixedRecordFolder } from '@/features/data-management/lib/treeValidator'
import {
  buildParsedTreeFromFiles,
  findOversizedUploadFiles,
  getUploadTreeRoot,
  hasInvalidUploadFiles,
  parsedTreeToDataNodes,
  type OversizedUploadFile,
} from '@/features/data-management/lib/uploadParser'
import type {
  DataDossierStatus,
  DataFolderEntityType,
  DataMetadataHistoryEntryT,
  DataMetadataHistoryRestoreResultT,
  DataRecordStatus,
  DataTreeNodeT,
  MakerClaimT,
} from '@/features/data-management/types'
import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'
import { createClientId } from '@/lib/utils/id'

let dynamicTree: DataTreeNodeT | null = null
const loadedNodes = new Set<string>()
let currentFetchRole: DataManagementRole = 'admin'
let editorClaimSnapshot: MakerClaimT | null = null

export type GetDataTreeOptions = {
  refresh?: boolean
  /** Editor only: claim a new maker assignment (do not use on save). */
  claimNext?: boolean
  dossierId?: string
}

const CHECKER_ASSIGNMENT_ROLES = [1, 2, 3, 4, 5].map((level) =>
  ASSIGN_FOLDER_ROLE.checker(level),
)

function findNode(node: DataTreeNodeT, id: string): DataTreeNodeT | null {
  if (node.id === id) return node
  for (const child of node.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

function findDossierRecordNode(
  root: DataTreeNodeT,
  dossierId: string,
): DataTreeNodeT | null {
  if (root.type === 'record') {
    const recordDossierId = root.dossierId ?? root.id
    if (recordDossierId === dossierId || root.id === dossierId) {
      return root
    }
  }

  for (const child of root.children) {
    const found = findDossierRecordNode(child, dossierId)
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
  if (role !== 'editor') {
    editorClaimSnapshot = null
  }
}

function getActiveEditorDossierId(): string | undefined {
  if (!dynamicTree) return undefined
  const record = dynamicTree.children.find((child) => child.type === 'record')
  if (!record) return undefined
  return record.dossierId ?? record.id
}

async function assembleEditorTreeFromClaim(
  claim: MakerClaimT,
): Promise<DataTreeNodeT> {
  const dossier = claim.dossier
  const dossierId = String(dossier.id)

  const dossierMeta: Record<string, unknown> = {
    ...(dossier as unknown as Record<string, unknown>),
  }
  if (claim.currentMetadataUrl) {
    dossierMeta.currentMetadataUrl = claim.currentMetadataUrl
  }
  if (claim.currentMetadata) {
    dossierMeta.currentMetadata = claim.currentMetadata
  }
  if (claim.allowedFields) {
    dossierMeta.allowedFields = claim.allowedFields
  }
  if (claim.rejectFields?.length) {
    dossierMeta.rejectFields = claim.rejectFields
  }

  const recordContent = await buildDossierRecordContent(dossierId, dossierMeta)

  let children = recordContent.children
  let dossierMetadata = recordContent.dossierMetadata
  let fullDossierMetadata =
    recordContent.fullDossierMetadata ?? recordContent.dossierMetadata

  if (children.length === 0 && (claim.files?.length ?? 0) > 0) {
    const resolved = await resolveClaimMetadata(claim)
    dossierMetadata = dossierMetadata ?? resolved.dossierMetadata
    fullDossierMetadata =
      fullDossierMetadata ??
      resolved.fullDossierMetadata ??
      resolved.dossierMetadata
    children = claim.files.map((file) =>
      mapFileToDocumentNode(
        file as unknown as Record<string, unknown>,
        dossierId,
        resolved.metadataGroups,
      ),
    )
  }

  const lastRejectNotes =
    typeof dossier.lastRejectNotes === 'string'
      ? dossier.lastRejectNotes.trim()
      : ''
  const rejectFields = Array.isArray(claim.rejectFields)
    ? claim.rejectFields.filter(
        (field): field is string =>
          typeof field === 'string' && field.trim() !== '',
      )
    : []

  const recordNode: DataTreeNodeT = {
    id: dossierId,
    name: String(dossier.name),
    type: 'record',
    parentId: DATA_TREE_ROOT_ID,
    children,
    sizeBytes: children.reduce((sum, doc) => sum + doc.sizeBytes, 0),
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'System',
    dossierId,
    entityType: 'DOCUMENT',
    dossierMetadata,
    ...(fullDossierMetadata ? { fullDossierMetadata } : {}),
    ...(rejectFields.length > 0 ? { rejectFields } : {}),
    ...(lastRejectNotes ? { lastRejectNotes } : {}),
  }
  applyDossierFields(recordNode, dossier as unknown as Record<string, unknown>)

  const rootNode = createEmptyRoot()
  rootNode.children = [recordNode]
  loadedNodes.add(DATA_TREE_ROOT_ID)
  loadedNodes.add(dossierId)
  currentFetchRole = 'editor'
  return rootNode
}

async function ensureEditorTreeLoaded(): Promise<void> {
  if (dynamicTree && currentFetchRole === 'editor') return

  if (editorClaimSnapshot) {
    dynamicTree = await assembleEditorTreeFromClaim(editorClaimSnapshot)
    return
  }

  dynamicTree = await buildEditorClaimTree()
}

function extractDossierId(source: Record<string, unknown>): string | undefined {
  if (source.dossierId != null) return String(source.dossierId)
  if (source.dossier_id != null) return String(source.dossier_id)
  const dossier = source.dossier
  if (
    dossier &&
    typeof dossier === 'object' &&
    (dossier as Record<string, unknown>).id != null
  ) {
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
  if (
    folder &&
    typeof folder === 'object' &&
    (folder as Record<string, unknown>).id != null
  ) {
    return String((folder as Record<string, unknown>).id)
  }
  return undefined
}

function parseEntityType(value: unknown): DataFolderEntityType | undefined {
  if (value === 'DOCUMENT' || value === 'FOLDER') return value
  return undefined
}

const DOSSIER_STATUSES = new Set<DataDossierStatus>([
  'NEW',
  'OCR_PROCESSING',
  'OCR_FAILED',
  'READY_FOR_ENTRY',
  'ENTRY_PROCESSING',
  'WAITING_CHECKER_1',
  'CHECKER_1_PROCESSING',
  'CHECKER_1_REJECTED',
  'WAITING_CHECKER_2',
  'CHECKER_2_PROCESSING',
  'CHECKER_2_REJECTED',
  'WAITING_CHECKER_3',
  'CHECKER_3_PROCESSING',
  'CHECKER_3_REJECTED',
  'WAITING_CHECKER_4',
  'CHECKER_4_PROCESSING',
  'CHECKER_4_REJECTED',
  'WAITING_CHECKER_5',
  'CHECKER_5_PROCESSING',
  'CHECKER_5_REJECTED',
  'APPROVED',
])

function parseDossierStatus(value: unknown): DataDossierStatus | undefined {
  if (
    typeof value === 'string' &&
    DOSSIER_STATUSES.has(value as DataDossierStatus)
  ) {
    return value as DataDossierStatus
  }
  return undefined
}

function isDossierFolderChild(child: Record<string, unknown>): boolean {
  return parseDossierStatus(child.status) != null
}

function unwrapFolderApiPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const record = payload.record
  if (record && typeof record === 'object') {
    return record as Record<string, unknown>
  }
  return payload
}

function extractRequiredQcCount(
  source: Record<string, unknown>,
): number | undefined {
  const value = source.requiredQcCount ?? source.required_qc_count
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined
}

function parseIsAssigned(source: Record<string, unknown>): boolean {
  const value = source.isAssigned ?? source.is_assigned
  return value === true
}

function folderPayloadHasAssignedChild(data: Record<string, unknown>): boolean {
  const children = Array.isArray(data.children) ? data.children : []
  return children.some((child) =>
    parseIsAssigned(child as Record<string, unknown>),
  )
}

/** Probe first-level subfolders to detect nested assignment without expanding. */
async function probeNestedAssignment(folderId: string): Promise<boolean> {
  const res = await apiClient.get<Record<string, unknown>>(
    `/api/v1/folders/${folderId}/all-first-subfolders`,
  )
  const data = unwrapFolderApiPayload(res.data)
  return folderPayloadHasAssignedChild(data)
}

/** Set isAssigned on container folders whose direct subfolders include assignments. */
async function enrichContainerFolderAssignmentFlags(
  children: Array<DataTreeNodeT>,
): Promise<void> {
  const containers = children.filter(
    (child) =>
      child.type === 'folder' && !child.isAssigned && !child.dossierStatus,
  )
  if (containers.length === 0) return

  await Promise.all(
    containers.map(async (child) => {
      try {
        if (await probeNestedAssignment(child.id)) {
          child.isAssigned = true
        }
      } catch {
        // Ignore probe failures — icon appears after manual expand.
      }
    }),
  )
}

function applyNodeSizeFromPayload(
  node: DataTreeNodeT,
  source: Record<string, unknown>,
): void {
  const sizeBytes = sizeKbToBytes(source.totalSizeKb ?? source.total_size_kb)
  if (sizeBytes > 0) {
    node.sizeBytes = sizeBytes
  }
}

function sumChildrenSizeBytes(children: Array<DataTreeNodeT>): number {
  return children.reduce((sum, child) => sum + child.sizeBytes, 0)
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
  const dossierStatus = parseDossierStatus(source.status)
  if (dossierStatus) node.dossierStatus = dossierStatus
  if (parseIsAssigned(source)) node.isAssigned = true
  if (source.name != null && String(source.name).trim()) {
    node.name = String(source.name)
  }
}

function mapFolderChild(child: Record<string, unknown>): DataTreeNodeT {
  const isDossier = isDossierFolderChild(child)
  const entityType = isDossier ? 'DOCUMENT' : parseEntityType(child.entityType)
  const folderId = extractDossierFolderId(child)
  const dossierId = extractDossierId(child)
  const requiredQcCount = extractRequiredQcCount(child)
  const dossierStatus = parseDossierStatus(child.status)

  return {
    id: String(child.id),
    name: String(child.folderName || child.name),
    type: 'folder',
    parentId: child.parentId != null ? String(child.parentId) : null,
    children: [],
    sizeBytes: sizeKbToBytes(child.totalSizeKb ?? child.total_size_kb),
    uploadedAt: String(child.createdAt || new Date().toISOString()),
    uploadedBy: 'System',
    ...(entityType ? { entityType } : {}),
    ...(dossierId ? { dossierId } : {}),
    ...(folderId ? { folderId } : {}),
    ...(requiredQcCount != null ? { requiredQcCount } : {}),
    ...(dossierStatus ? { dossierStatus } : {}),
    ...(parseIsAssigned(child) ? { isAssigned: true } : {}),
  }
}

async function buildAdminRootTree(): Promise<DataTreeNodeT> {
  const res = await apiClient.get<Record<string, unknown>>(
    '/api/v1/folders/all-parent',
  )
  const data = unwrapFolderApiPayload(res.data)
  const children = (Array.isArray(data.children) ? data.children : []).map(
    (child) => mapFolderChild(child as Record<string, unknown>),
  )

  await enrichContainerFolderAssignmentFlags(children)

  const root = createEmptyRoot()
  root.children = children
  loadedNodes.add(DATA_TREE_ROOT_ID)
  return root
}

async function buildEditorClaimTree(): Promise<DataTreeNodeT> {
  const claim = await claimMakerAssignment()
  editorClaimSnapshot = claim
  dynamicTree = await assembleEditorTreeFromClaim(claim)
  return dynamicTree
}

/** Refresh dossier documents/metadata from BE without reloading parent folder. */
export async function refreshDossierContent(
  dossierId: string,
): Promise<DataTreeNodeT> {
  if (!dynamicTree) {
    throw new Error('Data tree is not loaded')
  }

  const recordNode = findDossierRecordNode(dynamicTree, dossierId)
  if (!recordNode) {
    return cloneTree(dynamicTree)
  }

  const entityDossierId = recordNode.dossierId ?? dossierId
  const recordContent = await buildDossierRecordContent(entityDossierId, {
    name: recordNode.name,
    dossierId: entityDossierId,
    status: recordNode.dossierStatus,
  })

  recordNode.children = recordContent.children
  recordNode.dossierMetadata = recordContent.dossierMetadata
  recordNode.fullDossierMetadata =
    recordContent.fullDossierMetadata ?? recordContent.dossierMetadata
  recordNode.sizeBytes = recordContent.children.reduce(
    (sum, document) => sum + document.sizeBytes,
    0,
  )
  const refreshedStatus = parseDossierStatus(
    recordContent.dossierMetadata?.trang_thai_ho_so,
  )
  if (refreshedStatus) {
    recordNode.dossierStatus = refreshedStatus
  }

  return cloneTree(dynamicTree)
}

/** Refresh current editor dossier from BE without calling maker/claim again. */
export async function refreshEditorDossierTree(
  dossierId: string,
): Promise<DataTreeNodeT> {
  await ensureEditorTreeLoaded()
  return refreshDossierContent(dossierId)
}

async function buildAssignmentTree(role: 'qc'): Promise<DataTreeNodeT> {
  const assignmentLists = await Promise.all(
    CHECKER_ASSIGNMENT_ROLES.map(async (apiRole) => {
      const res = await apiClient.get<{
        assignments?: Array<{
          dossier?: Record<string, unknown>
        }>
      }>('/api/v1/dossiers/assignments/by-role', {
        params: { role: apiRole },
      })
      return res.data.assignments ?? []
    }),
  )

  const seenDossierIds = new Set<string>()
  const assignments: Array<{ dossier?: Record<string, unknown> }> = []
  for (const list of assignmentLists) {
    for (const assignment of list) {
      const dossierId = assignment.dossier?.id
      if (dossierId != null) {
        const id = String(dossierId)
        if (seenDossierIds.has(id)) continue
        seenDossierIds.add(id)
      }
      assignments.push(assignment)
    }
  }

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
          newNode.entityType = 'DOCUMENT'
          newNode.dossierId = dossierId
          applyDossierFields(newNode, dossier)
          const recordContent = await buildDossierRecordContent(
            dossierId,
            dossier,
          )
          newNode.children = recordContent.children
          newNode.dossierMetadata = recordContent.dossierMetadata
          newNode.fullDossierMetadata =
            recordContent.fullDossierMetadata ?? recordContent.dossierMetadata
          newNode.sizeBytes = sumChildrenSizeBytes(recordContent.children)
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

export type DataManagementUploadErrorCode =
  | 'mixedFolder'
  | 'invalidFile'
  | 'fileTooLarge'

export interface DataManagementUploadErrorDetails {
  oversizedFiles?: Array<OversizedUploadFile>
}

export class DataManagementUploadError extends Error {
  constructor(
    public readonly code: DataManagementUploadErrorCode,
    public readonly details?: DataManagementUploadErrorDetails,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'DataManagementUploadError'
    Object.setPrototypeOf(this, DataManagementUploadError.prototype)
  }
}

export function isDataManagementUploadError(
  error: unknown,
): error is DataManagementUploadError {
  return (
    error instanceof DataManagementUploadError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: unknown }).name === 'DataManagementUploadError' &&
      ((error as { code?: unknown }).code === 'mixedFolder' ||
        (error as { code?: unknown }).code === 'invalidFile' ||
        (error as { code?: unknown }).code === 'fileTooLarge'))
  )
}

/**
 * Remove a folder from the internal loaded-nodes cache so the next
 * `loadNodeChildren(nodeId)` call will re-fetch from the API instead of
 * returning the stale in-memory clone.
 */
export function clearLoadedNodeCache(nodeId: string): void {
  loadedNodes.delete(nodeId)
}

export function isNodeChildrenCached(nodeId: string): boolean {
  return loadedNodes.has(nodeId)
}

export type LoadNodeChildrenResultT = {
  tree: DataTreeNodeT
  changed: boolean
}

export type LoadNodeChildrenOptions = {
  /** Re-fetch from API even when the node is already in the loaded cache. */
  refresh?: boolean
}

function loadNodeChildrenResult(changed: boolean): LoadNodeChildrenResultT {
  if (!dynamicTree) {
    throw new Error('Data tree is not loaded')
  }
  return {
    tree: changed ? cloneTree(dynamicTree) : dynamicTree,
    changed,
  }
}

export async function getDataTree(
  role: DataManagementRole = 'admin',
  options?: GetDataTreeOptions,
): Promise<DataTreeNodeT> {
  if (role === 'editor') {
    if (options?.refresh && options.claimNext) {
      resetTreeCache(role)
      editorClaimSnapshot = null
      dynamicTree = await buildEditorClaimTree()
      return cloneTree(dynamicTree)
    }

    if (options?.refresh && !options.claimNext) {
      const targetDossierId =
        options.dossierId ??
        getActiveEditorDossierId() ??
        (editorClaimSnapshot
          ? String(editorClaimSnapshot.dossier.id)
          : undefined)

      if (targetDossierId) {
        await ensureEditorTreeLoaded()
        return refreshEditorDossierTree(targetDossierId)
      }
    }
  }

  if (options?.refresh) {
    resetTreeCache(role)
  }

  if (!dynamicTree || currentFetchRole !== role) {
    resetTreeCache(role)

    if (role === 'editor') {
      dynamicTree = editorClaimSnapshot
        ? await assembleEditorTreeFromClaim(editorClaimSnapshot)
        : await buildEditorClaimTree()
    } else if (role === 'qc') {
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
  options?: LoadNodeChildrenOptions,
): Promise<LoadNodeChildrenResultT> {
  if (!dynamicTree) {
    throw new Error('Data tree is not loaded')
  }

  const refresh = options?.refresh === true

  if (role === 'qc' || role === 'editor') {
    loadedNodes.add(nodeId)
    return loadNodeChildrenResult(false)
  }

  const node = findNode(dynamicTree, nodeId)
  if (!node) {
    return loadNodeChildrenResult(false)
  }

  if (node.type === 'record' && role === 'admin') {
    if (node.dossierMetadata && !refresh) {
      loadedNodes.add(nodeId)
      return loadNodeChildrenResult(false)
    }

    const dossierId = node.dossierId ?? node.id
    const recordContent = await buildDossierRecordContent(dossierId, {
      name: node.name,
      dossierId,
      status: node.dossierStatus,
    })

    node.children = recordContent.children.map((child) => ({
      ...child,
      parentId: nodeId,
    }))
    node.dossierMetadata = recordContent.dossierMetadata
    node.fullDossierMetadata =
      recordContent.fullDossierMetadata ?? recordContent.dossierMetadata
    node.sizeBytes = sumChildrenSizeBytes(recordContent.children)
    const refreshedStatus = parseDossierStatus(
      recordContent.dossierMetadata?.trang_thai_ho_so,
    )
    if (refreshedStatus) {
      node.dossierStatus = refreshedStatus
    }
    loadedNodes.add(nodeId)
    return loadNodeChildrenResult(true)
  }

  if (loadedNodes.has(nodeId) && !refresh) {
    return loadNodeChildrenResult(false)
  }

  if (node.type !== 'folder') {
    return loadNodeChildrenResult(false)
  }

  const res = await apiClient.get<Record<string, unknown>>(
    `/api/v1/folders/${nodeId}/all-first-subfolders`,
  )
  const data = unwrapFolderApiPayload(res.data)

  // When children are replaced, evict the old child IDs from loadedNodes so
  // subsequent clicks re-fetch their contents instead of serving stale cache.
  function evictOldChildren(oldChildren: Array<DataTreeNodeT>) {
    for (const child of oldChildren) {
      loadedNodes.delete(child.id)
    }
  }

  function evictRemovedChildren(
    oldChildren: Array<DataTreeNodeT>,
    nextChildren: Array<DataTreeNodeT>,
  ) {
    const nextIds = new Set(nextChildren.map((child) => child.id))
    for (const child of oldChildren) {
      if (!nextIds.has(child.id)) {
        loadedNodes.delete(child.id)
      }
    }
  }

  if (data.nodeType === 'folder') {
    const incomingChildren = (
      Array.isArray(data.children) ? data.children : []
    ).map((child) => mapFolderChild(child as Record<string, unknown>))
    await enrichContainerFolderAssignmentFlags(incomingChildren)

    const { children: mergedChildren, changed: childrenChanged } =
      mergeListingChildren(node.children, incomingChildren)

    const nextIsAssigned = mergedChildren.some((child) => child.isAssigned)

    if (!childrenChanged && node.isAssigned === nextIsAssigned) {
      loadedNodes.add(nodeId)
      return loadNodeChildrenResult(false)
    }

    if (childrenChanged) {
      evictRemovedChildren(node.children, mergedChildren)
      node.children = mergedChildren
    }

    if (node.isAssigned !== nextIsAssigned) {
      node.isAssigned = nextIsAssigned
    }
    applyNodeSizeFromPayload(node, data)
  } else if (data.nodeType === 'dossier') {
    const dossiers = Array.isArray(data.children) ? data.children : []
    const allFiles: Array<DataTreeNodeT> = []
    let dossierMetadata
    let fullDossierMetadata
    const firstDossierStatus = parseDossierStatus(
      (dossiers[0] as Record<string, unknown> | undefined)?.status,
    )

    for (const dossier of dossiers) {
      const dossierRecord = dossier as Record<string, unknown>
      if (!node.dossierId && dossierRecord.id != null) {
        node.dossierId = String(dossierRecord.id)
      }
      const recordContent = await buildDossierRecordContent(
        String(dossierRecord.id),
        dossierRecord,
      )
      allFiles.push(
        ...recordContent.children.map((child) => ({
          ...child,
          parentId: nodeId,
        })),
      )
      dossierMetadata = recordContent.dossierMetadata ?? dossierMetadata
      fullDossierMetadata =
        recordContent.fullDossierMetadata ??
        recordContent.dossierMetadata ??
        fullDossierMetadata
    }

    evictOldChildren(node.children)
    node.children = allFiles
    node.type = 'record'
    node.entityType = 'DOCUMENT'
    node.folderId = nodeId
    applyDossierFields(node, data)
    const firstDossier = dossiers[0] as Record<string, unknown> | undefined
    if (firstDossier) applyDossierFields(node, firstDossier)
    node.folderId = nodeId
    node.dossierMetadata = dossierMetadata
    node.fullDossierMetadata = fullDossierMetadata ?? dossierMetadata
    if (firstDossierStatus) node.dossierStatus = firstDossierStatus
    const childSum = sumChildrenSizeBytes(node.children)
    if (childSum > 0) {
      node.sizeBytes = childSum
    } else {
      applyNodeSizeFromPayload(node, data)
    }
  } else if (data.nodeType === 'file') {
    const metaUrl = resolveMetadataUrl(data)
    const [metadataGroups, fetchedMetadata] = await Promise.all([
      fetchMetadataGroups(metaUrl),
      fetchDossierMetadata(metaUrl),
    ])
    const dossierMetadata = fetchedMetadata
      ? dedupeDossierMetadataMergeArtifacts(fetchedMetadata)
      : undefined
    const children = Array.isArray(data.children) ? data.children : []

    evictOldChildren(node.children)
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
    node.dossierMetadata = dossierMetadata
    node.fullDossierMetadata = dossierMetadata
    const childSum = sumChildrenSizeBytes(node.children)
    if (childSum > 0) {
      node.sizeBytes = childSum
    } else {
      applyNodeSizeFromPayload(node, data)
    }
  }

  loadedNodes.add(nodeId)
  return loadNodeChildrenResult(true)
}

export function validateFolderUploadFiles(files: Array<File>): void {
  if (files.length === 0) {
    throw new DataManagementUploadError('invalidFile')
  }

  if (hasInvalidUploadFiles(files)) {
    throw new DataManagementUploadError('invalidFile')
  }

  const oversizedFiles = findOversizedUploadFiles(
    files,
    env.DATA_UPLOAD_MAX_FILE_SIZE_BYTES,
  )
  if (oversizedFiles.length > 0) {
    throw new DataManagementUploadError('fileTooLarge', { oversizedFiles })
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
}

export async function uploadDataFolder(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadFolderOptions,
): Promise<UploadFolderResult> {
  validateFolderUploadFiles(files)
  return uploadFolderFiles(files, onProgress, options)
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

export type DataDeleteRequestT = {
  target: 'dossier' | 'folder'
  id: string
  permanent: boolean
}

/** Delete dossier or folder collection — soft delete by default, `permanent=true` for hard delete. */
export async function deleteDataNode({
  target,
  id,
  permanent,
}: DataDeleteRequestT): Promise<void> {
  const params = permanent ? { permanent: true } : undefined

  if (target === 'dossier') {
    await apiClient.delete(`/api/v1/dossiers/${id}`, { params })
    return
  }

  await apiClient.delete(`/api/v1/folders/${id}/dossiers`, { params })
}

export async function addDataDocument(
  parentId: string,
): Promise<DataTreeNodeT> {
  const tree = requireDynamicTree()
  const createdAt = new Date().toISOString()
  const document: DataTreeNodeT = {
    id: createClientId('dm-doc'),
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
    id: createClientId('dm-folder'),
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

const MAX_DOSSIER_FOLDER_SEARCH_DEPTH = 8

function dossierIdFromFolderPayload(
  data: Record<string, unknown>,
): string | null {
  const fromPayload = extractDossierId(data)
  if (fromPayload) return fromPayload

  if (data.nodeType === 'dossier') {
    const dossiers = Array.isArray(data.children) ? data.children : []
    for (const dossier of dossiers) {
      const record = dossier as Record<string, unknown>
      if (record.id != null) return String(record.id)
    }
  }

  return null
}

/** Walk subfolders until a dossier/file node is found (parent folder → nested record). */
export async function fetchDossierTargetByFolderId(
  folderId: string,
  options?: { maxDepth?: number },
): Promise<DossierFolderTarget | null> {
  const maxDepth = options?.maxDepth ?? MAX_DOSSIER_FOLDER_SEARCH_DEPTH

  async function visit(
    id: string,
    depth: number,
  ): Promise<DossierFolderTarget | null> {
    if (depth > maxDepth) return null

    const res = await apiClient.get<Record<string, unknown>>(
      `/api/v1/folders/${id}/all-first-subfolders`,
    )
    const data = unwrapFolderApiPayload(res.data)
    const dossierId = dossierIdFromFolderPayload(data)

    if (
      dossierId &&
      (data.nodeType === 'file' || data.nodeType === 'dossier')
    ) {
      return { dossierId, dossierFolderId: id }
    }

    if (data.nodeType === 'folder') {
      const children = Array.isArray(data.children) ? data.children : []
      for (const child of children) {
        const record = child as Record<string, unknown>
        if (record.id == null) continue

        const childDossierId = extractDossierId(record)
        if (childDossierId && isDossierFolderChild(record)) {
          return {
            dossierId: childDossierId,
            dossierFolderId: String(record.id),
          }
        }

        const found = await visit(String(record.id), depth + 1)
        if (found) return found
      }
    }

    return null
  }

  return visit(folderId, 0)
}

/** Resolve dossier entity id from folder id when tree node has no dossierId yet. */
export async function fetchDossierIdByFolderId(
  folderId: string,
): Promise<string | null> {
  const target = await fetchDossierTargetByFolderId(folderId)
  return target?.dossierId ?? null
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
  dossierId,
  assigneeId,
}: {
  dossierId: string
  assigneeId: string
}): Promise<void> {
  await apiClient.post(`/api/v1/dossiers/${dossierId}/assign`, {
    assigneeId,
    role: ASSIGN_FOLDER_ROLE.maker,
  })
}

/** GET /api/v1/dossiers/:id/metadata-history — metadata edit history */
export async function fetchDossierMetadataHistory(
  dossierId: string,
): Promise<Array<DataMetadataHistoryEntryT>> {
  const response = await apiClient.get<Array<DataMetadataHistoryEntryT>>(
    `/api/v1/dossiers/${dossierId}/metadata-history`,
  )
  return response.data
}

/** GET /api/v1/dossiers/:id/metadata-history/:historyId — single history entry */
export async function fetchDossierMetadataHistoryEntry(
  dossierId: string,
  historyId: string,
): Promise<DataMetadataHistoryEntryT> {
  const response = await apiClient.get<DataMetadataHistoryEntryT>(
    `/api/v1/dossiers/${dossierId}/metadata-history/${historyId}`,
  )
  return response.data
}

/** POST /api/v1/dossiers/:id/metadata-history/:historyId/restore */
export async function restoreDossierMetadataHistory(
  dossierId: string,
  historyId: string,
): Promise<DataMetadataHistoryRestoreResultT> {
  const response = await apiClient.post<DataMetadataHistoryRestoreResultT>(
    `/api/v1/dossiers/${dossierId}/metadata-history/${historyId}/restore`,
  )
  return response.data
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
