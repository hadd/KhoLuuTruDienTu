import { claimMakerAssignment } from '@/features/data-management/api/dataEntryClient'
import type {
  UploadFolderOptions,
  UploadFolderResult,
  UploadProgress,
} from '@/features/data-management/api/dossierClient'
import { uploadFolderFiles } from '@/features/data-management/api/dossierClient'
import type { DataManagementRole } from '@/features/data-management/config/roleConfig'
import { isProjectScopedDataRole } from '@/features/data-management/config/roleConfig'
import { applyCheckerAssignmentsToNode } from '@/features/data-management/lib/checkerAssignmentHelpers'
import {
  ASSIGN_FOLDER_ROLE,
  DATA_TREE_ROOT_ID,
  toScopedProjectCode,
} from '@/features/data-management/lib/constants'
import { getCheckerLevelForDossierStatus } from '@/features/data-management/lib/dossierStatusHelpers'
import {
  buildDossierRecordContent,
  dedupeDossierMetadataMergeArtifacts,
  fetchDossierMetadata,
  fetchMetadataGroups,
  mapFileToDocumentNode,
  resolveClaimMetadata,
  resolveMetadataUrl,
  sizeKbToBytes,
} from '@/features/data-management/lib/metadataHelpers'
import {
  normalizeAllowedFields,
  resolveShouldPdfMaskFromMetadata,
} from '@/features/data-management/lib/pdfMaskPolicy'
import { classifyFolderTypes } from '@/features/data-management/lib/treeClassifier'
import type { DossierFolderTarget } from '@/features/data-management/lib/treeUtils'
import { mergeListingChildren } from '@/features/data-management/lib/treeUtils'
import { validateNoMixedRecordFolder } from '@/features/data-management/lib/treeValidator'
import type { OversizedUploadFile } from '@/features/data-management/lib/uploadParser'
import {
  buildParsedTreeFromFiles,
  findOversizedUploadFiles,
  getUploadTreeRoot,
  hasInvalidUploadFiles,
  parsedTreeToDataNodes,
} from '@/features/data-management/lib/uploadParser'
import type {
  DataDossierStatus,
  DataFolderEntityType,
  DataMetadataHistoryEntryT,
  DataMetadataHistoryRestoreResultT,
  DataRecordStatus,
  DataTreeNodeT,
  IssueReportT,
  MakerClaimT,
} from '@/features/data-management/types'
import { buildEditorClaimFromDraftDossier } from '@/features/editor-dossiers/api/editorDossierClient'
import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'
import { createClientId } from '@/lib/utils/id'

let dynamicTree: DataTreeNodeT | null = null
const loadedNodes = new Set<string>()
let currentFetchRole: DataManagementRole = 'admin'
let currentProjectCode: string | null = null
let editorClaimSnapshot: MakerClaimT | null = null
let editorDraftDossierId: string | null = null

export type GetDataTreeOptions = {
  refresh?: boolean
  /** Editor only: claim a new maker assignment (do not use on save). */
  claimNext?: boolean
  dossierId?: string
  /** Admin only: scope folder tree to a project. */
  projectCode?: string
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

function resetTreeCache(role: DataManagementRole, projectCode?: string | null) {
  const nextProjectCode = projectCode ?? currentProjectCode
  const projectChanged =
    isProjectScopedDataRole(role) &&
    nextProjectCode != null &&
    nextProjectCode !== currentProjectCode

  currentFetchRole = role
  if (projectChanged || projectCode !== undefined) {
    currentProjectCode = nextProjectCode
  }
  dynamicTree = null
  loadedNodes.clear()
  if (role !== 'editor') {
    editorClaimSnapshot = null
    editorDraftDossierId = null
  }
}

function requireAdminProjectCode(): string {
  if (!currentProjectCode?.trim()) {
    throw new Error('Project code is required')
  }
  return currentProjectCode
}

async function fetchAllFirstSubfoldersPayload(
  folderId: string,
  projectCode?: string,
): Promise<Record<string, unknown>> {
  const scopedProjectCode = toScopedProjectCode(projectCode)
  const params = scopedProjectCode ? { projectCode: scopedProjectCode } : undefined
  const res = await apiClient.get<Record<string, unknown>>(
    `/api/v1/folders/${folderId}/all-first-subfolders`,
    { params },
  )
  return unwrapFolderApiPayload(res.data)
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

  const recordContent = await buildDossierRecordContent(
    dossierId,
    dossierMeta,
    editorDraftDossierId === dossierId ? { filesStatus: 'draft' } : undefined,
  )

  const claimMetadata = await resolveClaimMetadata(claim)

  let children = recordContent.children
  let dossierMetadata =
    claimMetadata.dossierMetadata ?? recordContent.dossierMetadata
  let fullDossierMetadata =
    claimMetadata.fullDossierMetadata ??
    recordContent.fullDossierMetadata ??
    recordContent.dossierMetadata

  if (children.length === 0 && (claim.files?.length ?? 0) > 0) {
    dossierMetadata = dossierMetadata ?? claimMetadata.dossierMetadata
    fullDossierMetadata =
      fullDossierMetadata ??
      claimMetadata.fullDossierMetadata ??
      claimMetadata.dossierMetadata
    children = claim.files.map((file) =>
      mapFileToDocumentNode(
        file as unknown as Record<string, unknown>,
        dossierId,
        claimMetadata.metadataGroups,
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

  const assignmentStatus =
    typeof claim.assignment.status === 'string'
      ? claim.assignment.status.trim()
      : undefined

  const allowedFields = normalizeAllowedFields(claim.allowedFields)
  const shouldPdfMask = resolveShouldPdfMaskFromMetadata({
    allowedFields,
    dossierMetadata,
    fullDossierMetadata,
  })

  const claimIssueReport =
    claim.issueReport && typeof claim.issueReport === 'object'
      ? claim.issueReport
      : undefined

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
    ...(allowedFields ? { allowedFields } : {}),
    shouldPdfMask,
    ...(rejectFields.length > 0 ? { rejectFields } : {}),
    ...(lastRejectNotes ? { lastRejectNotes } : {}),
    ...(dossier.isReturned ? { isReturned: true } : {}),
    ...(assignmentStatus ? { assignmentStatus } : {}),
    ...(claimIssueReport ? { claimIssueReport } : {}),
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

function extractProjectCode(
  source: Record<string, unknown>,
): string | undefined {
  const value = source.projectCode ?? source.project_code
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function extractFondId(source: Record<string, unknown>): string | undefined {
  const value = source.fondId ?? source.fond_id
  if (value == null) return undefined
  const trimmed = String(value).trim()
  return trimmed || undefined
}

function resolveAdminProjectCode(explicit?: string): string {
  const code = explicit?.trim() || currentProjectCode?.trim()
  if (!code) {
    throw new Error('Project code is required')
  }
  return code
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
  node.isAssigned = parseIsAssigned(source)
  const projectCode = extractProjectCode(source)
  if (projectCode) node.projectCode = projectCode
  const fondId = extractFondId(source)
  if (fondId) node.fondId = fondId
  if (source.name != null && String(source.name).trim()) {
    node.name = String(source.name)
  }
  applyCheckerAssignmentsToNode(node, source)
}

function mapFolderChild(child: Record<string, unknown>): DataTreeNodeT {
  const isDossier = isDossierFolderChild(child)
  const entityType = isDossier ? 'DOCUMENT' : parseEntityType(child.entityType)
  const folderId = extractDossierFolderId(child)
  const dossierId = extractDossierId(child)
  const requiredQcCount = extractRequiredQcCount(child)
  const dossierStatus = parseDossierStatus(child.status)
  const projectCode = extractProjectCode(child)
  const fondId = extractFondId(child)

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
    ...(projectCode ? { projectCode } : {}),
    ...(fondId ? { fondId } : {}),
    ...(child.folderPath ? { folderPath: String(child.folderPath) } : {}),
    isAssigned: parseIsAssigned(child),
  }
}

async function buildAdminRootTree(projectCode: string): Promise<DataTreeNodeT> {
  const scopedProjectCode = toScopedProjectCode(projectCode)
  const params = scopedProjectCode
    ? { projectCode: scopedProjectCode }
    : undefined
  const res = await apiClient.get<Record<string, unknown>>(
    '/api/v1/folders/all-parent',
    { params },
  )
  const data = unwrapFolderApiPayload(res.data)
  const children = (Array.isArray(data.children) ? data.children : []).map(
    (child) => ({
      ...mapFolderChild(child as Record<string, unknown>),
      parentId: DATA_TREE_ROOT_ID,
      suppressAssignedIndicator: true,
    }),
  )

  const root = createEmptyRoot()
  root.children = children
  loadedNodes.add(DATA_TREE_ROOT_ID)
  return root
}

async function loadEditorDossierFromDraft(
  dossierId: string,
): Promise<DataTreeNodeT | null> {
  const claim = await buildEditorClaimFromDraftDossier(dossierId)
  if (!claim) return null

  resetTreeCache('editor')
  editorClaimSnapshot = claim
  editorDraftDossierId = dossierId
  dynamicTree = await assembleEditorTreeFromClaim(claim)
  return cloneTree(dynamicTree)
}

async function buildEditorClaimTree(): Promise<DataTreeNodeT> {
  const claim = await claimMakerAssignment()
  editorClaimSnapshot = claim
  editorDraftDossierId = null
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
  const recordContent = await buildDossierRecordContent(
    entityDossierId,
    {
      name: recordNode.name,
      dossierId: entityDossierId,
      status: recordNode.dossierStatus,
    },
    editorDraftDossierId === entityDossierId
      ? { filesStatus: 'draft' }
      : undefined,
  )

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
    CHECKER_ASSIGNMENT_ROLES.map(async (apiRole, index) => {
      const checkerLevel = index + 1
      const res = await apiClient.get<{
        assignments?: Array<{
          dossier?: Record<string, unknown>
          issueReports?: Array<IssueReportT>
        }>
      }>('/api/v1/dossiers/assignments/by-role', {
        params: { role: apiRole },
      })
      return {
        checkerLevel,
        assignments: res.data.assignments ?? [],
      }
    }),
  )

  const assignmentEntries = new Map<
    string,
    { checkerLevel: number; dossier: Record<string, unknown> }
  >()
  const dossierPendingReports = new Map<string, Map<string, IssueReportT>>()

  for (const { checkerLevel, assignments: list } of assignmentLists) {
    for (const assignment of list) {
      const dossier = assignment.dossier
      if (!dossier?.id) continue

      const id = String(dossier.id)
      for (const report of assignment.issueReports ?? []) {
        if (report.status !== 'PENDING') continue
        const pendingById = dossierPendingReports.get(id) ?? new Map()
        pendingById.set(report.id, report)
        dossierPendingReports.set(id, pendingById)
      }

      const statusLevel = getCheckerLevelForDossierStatus(
        parseDossierStatus(dossier.status),
      )
      const existing = assignmentEntries.get(id)

      if (!existing) {
        assignmentEntries.set(id, { checkerLevel, dossier })
        continue
      }

      if (
        statusLevel === checkerLevel &&
        existing.checkerLevel !== statusLevel
      ) {
        assignmentEntries.set(id, { checkerLevel, dossier })
      }
    }
  }

  const assignments = [...assignmentEntries.values()]

  const rootNode = createEmptyRoot()
  const nodesMap = new Map<string, DataTreeNodeT>()
  nodesMap.set(DATA_TREE_ROOT_ID, rootNode)

  for (const assignment of assignments) {
    const dossier = assignment.dossier
    if (!dossier.folderPath) continue

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
          newNode.assignedCheckerLevel = assignment.checkerLevel
          const pendingReports = [
            ...(dossierPendingReports.get(dossierId)?.values() ?? []),
          ]
          if (pendingReports.length > 0) {
            newNode.pendingIssueReportCount = pendingReports.length
            newNode.assignmentIssueReports = pendingReports
          }
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
      } else if (isLast) {
        const existing = nodesMap.get(nodeId)
        if (existing) {
          const pendingReports = [
            ...(dossierPendingReports.get(dossierId)?.values() ?? []),
          ]
          if (pendingReports.length > 0) {
            existing.pendingIssueReportCount = pendingReports.length
            existing.assignmentIssueReports = pendingReports
          } else {
            delete existing.pendingIssueReportCount
            delete existing.assignmentIssueReports
          }
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
  /** Admin only: scope folder children to a project. */
  projectCode?: string
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
  const projectCode = isProjectScopedDataRole(role)
    ? (options?.projectCode ?? currentProjectCode ?? undefined)
    : undefined

  if (isProjectScopedDataRole(role) && !projectCode?.trim()) {
    throw new Error('Project code is required')
  }

  if (role === 'editor') {
    if (options?.refresh && options.claimNext) {
      resetTreeCache(role)
      editorClaimSnapshot = null
      editorDraftDossierId = null
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

      if (options.dossierId) {
        const draftTree = await loadEditorDossierFromDraft(options.dossierId)
        if (draftTree) return draftTree
      }

      if (targetDossierId) {
        await ensureEditorTreeLoaded()
        return refreshEditorDossierTree(targetDossierId)
      }
    }
  }

  const projectChanged =
    isProjectScopedDataRole(role) && projectCode !== currentProjectCode

  if (options?.refresh || projectChanged) {
    resetTreeCache(role, projectCode)
  }

  if (!dynamicTree || currentFetchRole !== role || projectChanged) {
    resetTreeCache(role, projectCode)

    if (role === 'editor') {
      dynamicTree = editorClaimSnapshot
        ? await assembleEditorTreeFromClaim(editorClaimSnapshot)
        : await buildEditorClaimTree()
    } else if (role === 'qc') {
      dynamicTree = await buildAssignmentTree(role)
    } else {
      dynamicTree = await buildAdminRootTree(projectCode!)
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

  if (node.type === 'record' && isProjectScopedDataRole(role)) {
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

  const projectCode = isProjectScopedDataRole(role)
    ? resolveAdminProjectCode(options?.projectCode)
    : undefined
  const data = await fetchAllFirstSubfoldersPayload(nodeId, projectCode)

  const responseProjectCode = extractProjectCode(data)
  if (responseProjectCode) {
    node.projectCode = responseProjectCode
  }

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

  function evictDegradedDossierCache(
    before: Array<DataTreeNodeT>,
    after: Array<DataTreeNodeT>,
  ) {
    const afterById = new Map(after.map((child) => [child.id, child]))
    for (const child of before) {
      const next = afterById.get(child.id)
      if (!next) continue

      const wasEnriched =
        child.type === 'record' ||
        child.dossierMetadata != null ||
        child.children.length > 0
      const isDegraded =
        next.type === 'folder' &&
        next.children.length === 0 &&
        next.dossierMetadata == null

      if (wasEnriched && isDegraded) {
        loadedNodes.delete(child.id)
      }
    }
  }

  if (data.nodeType === 'folder') {
    const incomingChildren = (
      Array.isArray(data.children) ? data.children : []
    ).map((child) => mapFolderChild(child as Record<string, unknown>))

    const { children: mergedChildren, changed: childrenChanged } =
      mergeListingChildren(node.children, incomingChildren)

    if (!childrenChanged) {
      loadedNodes.add(nodeId)
      return loadNodeChildrenResult(false)
    }

    evictDegradedDossierCache(node.children, mergedChildren)
    evictRemovedChildren(node.children, mergedChildren)
    node.children = mergedChildren
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

    // Top-level container folders (e.g. "raw") are always parents — never turn
    // them into a hồ sơ record. Keep them as folders (no status badge, no
    // duplicate "raw" child) and just show their files directly.
    if (node.parentId === DATA_TREE_ROOT_ID) {
      node.dossierId = undefined
      evictOldChildren(node.children)
      node.children = allFiles
      const childSum = sumChildrenSizeBytes(node.children)
      if (childSum > 0) {
        node.sizeBytes = childSum
      } else {
        applyNodeSizeFromPayload(node, data)
      }

      loadedNodes.add(nodeId)
      return loadNodeChildrenResult(true)
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

export function validateDocumentUploadFiles(files: Array<File>): void {
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
}

export async function uploadDataFolder(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadFolderOptions,
): Promise<UploadFolderResult> {
  validateFolderUploadFiles(files)
  return uploadFolderFiles(files, onProgress, options)
}

export async function uploadDataDocuments(
  files: Array<File>,
  onProgress?: (progress: UploadProgress) => void,
  options?: UploadFolderOptions,
): Promise<UploadFolderResult> {
  validateDocumentUploadFiles(files)
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

function pruneNodeFromTree(
  root: DataTreeNodeT,
  targetId: string,
): DataTreeNodeT {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== targetId)
      .map((child) => pruneNodeFromTree(child, targetId)),
  }
}

/** Remove a node from the in-memory tree (optimistic UI after delete). */
export function removeNodeFromTree(nodeId: string): DataTreeNodeT | null {
  if (!dynamicTree || dynamicTree.id === nodeId) return null

  dynamicTree = recomputeFolderSizes(pruneNodeFromTree(dynamicTree, nodeId))
  loadedNodes.delete(nodeId)

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

    const projectCode = isProjectScopedDataRole(currentFetchRole)
      ? requireAdminProjectCode()
      : undefined
    const data = await fetchAllFirstSubfoldersPayload(id, projectCode)
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

function applyDossierFieldsToTreeNode(
  node: DataTreeNodeT,
  dossierId: string,
  updates: {
    name?: string
    requiredQcCount?: number
    fondId?: string
  },
): DataTreeNodeT {
  if (node.dossierId !== dossierId && node.id !== dossierId) {
    return node
  }

  return {
    ...node,
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.requiredQcCount !== undefined
      ? { requiredQcCount: updates.requiredQcCount }
      : {}),
    ...(updates.fondId !== undefined ? { fondId: updates.fondId } : {}),
  }
}

/** Update dossier — PUT /api/v1/dossiers/:id */
export async function updateDossier({
  id,
  name,
  requiredQcCount,
  fondId,
}: {
  id: string
  name?: string
  requiredQcCount?: number
  fondId?: string
}): Promise<DataTreeNodeT | undefined> {
  const body: Record<string, string | number> = {}
  if (name !== undefined) body.name = name
  if (requiredQcCount !== undefined) body.requiredQcCount = requiredQcCount
  if (fondId !== undefined) body.fondId = fondId
  await apiClient.put(`/api/v1/dossiers/${id}`, body)

  if (!dynamicTree) {
    return undefined
  }

  dynamicTree = mapTree(dynamicTree, (node) =>
    applyDossierFieldsToTreeNode(node, id, { name, requiredQcCount, fondId }),
  )

  return cloneTree(dynamicTree)
}

/** POST /api/v1/folders/:folderId/revoke-assignments */
export async function revokeFolderAssignments(folderId: string): Promise<void> {
  await apiClient.post(
    `/api/v1/folders/${encodeURIComponent(folderId)}/revoke-assignments`,
  )
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
  dossierStatus?: DataDossierStatus,
): `reviewer${1 | 2 | 3 | 4 | 5}` | 'editor' | null {
  const checkerLevel = getCheckerLevelForDossierStatus(dossierStatus)
  if (checkerLevel != null) {
    return `reviewer${checkerLevel}` as `reviewer${1 | 2 | 3 | 4 | 5}`
  }

  if (status === 'pendingOcr') return 'editor'
  if (status === 'edited') return 'reviewer1'
  if (status === 'pendingApproval' || status === 'approved1') return 'reviewer2'
  if (status === 'approved2' || status === 'final') return 'reviewer3'
  return null
}
