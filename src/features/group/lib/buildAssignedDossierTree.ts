import { DATA_TREE_ROOT_ID } from '@/features/data-management/lib/constants'
import type {
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'
import type { GroupAssignedDossierT } from '@/features/group/types'

const DOSSIER_STATUSES = new Set<string>([
  'NEW',
  'OCR_PROCESSING',
  'OCR_FAILED',
  'READY_FOR_ENTRY',
  'ENTRY_DRAFT',
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
  'APPROVED',
])

function parseDossierStatus(value: string): DataDossierStatus | undefined {
  if (DOSSIER_STATUSES.has(value)) {
    return value as DataDossierStatus
  }
  return undefined
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

function normalizeFolderPath(folderPath: string): Array<string> {
  let path = folderPath.trim()
  if (path.startsWith('raw/')) {
    path = path.slice(4)
  }
  return path.split('/').filter(Boolean)
}

function getEditorNames(dossier: GroupAssignedDossierT): {
  primaryEditor: { userId: string; fullName: string | null } | undefined
  editorNames: Array<string>
} {
  const editors = dossier.editors ?? []
  const primaryEditor = editors[0]
  const editorNames = editors
    .map((editor) => editor.fullName?.trim() || editor.userId)
    .filter(Boolean)
  return { primaryEditor, editorNames }
}

function createRecordNode(
  dossier: GroupAssignedDossierT,
  parentId: string,
  displayName: string,
): DataTreeNodeT {
  const dossierStatus = parseDossierStatus(dossier.status)
  const { primaryEditor, editorNames } = getEditorNames(dossier)

  return {
    id: dossier.id,
    name: displayName,
    type: 'record',
    parentId,
    children: [],
    sizeBytes: 0,
    uploadedAt: dossier.updatedAt || dossier.createdAt,
    uploadedBy: 'System',
    entityType: 'DOCUMENT',
    dossierId: dossier.id,
    folderId: dossier.folderId,
    isAssigned: true,
    ...(dossierStatus ? { dossierStatus } : {}),
    ...(dossier.projectCode ? { projectCode: dossier.projectCode } : {}),
    ...(dossier.requiredQcCount != null
      ? { requiredQcCount: dossier.requiredQcCount }
      : {}),
    ...(primaryEditor
      ? {
          editor: {
            id: primaryEditor.userId,
            name: editorNames.join(', '),
            role: 'editor' as const,
          },
        }
      : {}),
  }
}

function upsertRecordFields(
  existing: DataTreeNodeT,
  dossier: GroupAssignedDossierT,
  displayName: string,
): void {
  const dossierStatus = parseDossierStatus(dossier.status)
  const { primaryEditor, editorNames } = getEditorNames(dossier)

  existing.name = displayName
  existing.dossierId = dossier.id
  existing.folderId = dossier.folderId
  existing.isAssigned = true
  if (dossierStatus) existing.dossierStatus = dossierStatus
  if (primaryEditor) {
    existing.editor = {
      id: primaryEditor.userId,
      name: editorNames.join(', '),
      role: 'editor',
    }
  } else {
    delete existing.editor
  }
}

/** Build a read-only folder tree from flat assigned dossier rows. */
export function buildAssignedDossierTree(
  dossiers: Array<GroupAssignedDossierT>,
): DataTreeNodeT {
  const rootNode = createEmptyRoot()
  const nodesMap = new Map<string, DataTreeNodeT>()
  nodesMap.set(DATA_TREE_ROOT_ID, rootNode)

  for (const dossier of dossiers) {
    const segments = dossier.folderPath?.trim()
      ? normalizeFolderPath(dossier.folderPath)
      : []

    // Fallback: attach record under root when folderPath is missing / only "raw/"
    if (segments.length === 0) {
      const displayName = dossier.name?.trim() || dossier.id
      if (!nodesMap.has(dossier.id)) {
        const newNode = createRecordNode(
          dossier,
          DATA_TREE_ROOT_ID,
          displayName,
        )
        nodesMap.set(dossier.id, newNode)
        rootNode.children.push(newNode)
      } else {
        const existing = nodesMap.get(dossier.id)
        if (existing) {
          upsertRecordFields(existing, dossier, displayName)
        }
      }
      continue
    }

    let currentParentId = DATA_TREE_ROOT_ID

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      const isLast = index === segments.length - 1
      const nodePath = segments.slice(0, index + 1).join('/')
      const dossierId = dossier.id
      const nodeId = isLast ? dossierId : `group-assigned-node-${nodePath}`

      if (!nodesMap.has(nodeId)) {
        const newNode: DataTreeNodeT = isLast
          ? createRecordNode(
              dossier,
              currentParentId,
              dossier.name || segment,
            )
          : {
              id: nodeId,
              name: segment,
              type: 'folder',
              parentId: currentParentId,
              children: [],
              sizeBytes: 0,
              uploadedAt: dossier.updatedAt || dossier.createdAt,
              uploadedBy: 'System',
            }

        nodesMap.set(nodeId, newNode)
        const parent = nodesMap.get(currentParentId)
        if (parent) {
          parent.children.push(newNode)
        }
      } else if (isLast) {
        const existing = nodesMap.get(nodeId)
        if (existing) {
          upsertRecordFields(existing, dossier, dossier.name || segment)
        }
      }

      currentParentId = nodeId
    }
  }

  return rootNode
}
