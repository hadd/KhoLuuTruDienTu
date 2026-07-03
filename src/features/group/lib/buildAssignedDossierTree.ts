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

/** Build a read-only folder tree from flat assigned dossier rows. */
export function buildAssignedDossierTree(
  dossiers: Array<GroupAssignedDossierT>,
): DataTreeNodeT {
  const rootNode = createEmptyRoot()
  const nodesMap = new Map<string, DataTreeNodeT>()
  nodesMap.set(DATA_TREE_ROOT_ID, rootNode)

  for (const dossier of dossiers) {
    if (!dossier.folderPath?.trim()) continue

    const segments = normalizeFolderPath(dossier.folderPath)
    if (segments.length === 0) continue

    let currentParentId = DATA_TREE_ROOT_ID

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      const isLast = index === segments.length - 1
      const nodePath = segments.slice(0, index + 1).join('/')
      const dossierId = dossier.id
      const nodeId = isLast ? dossierId : `group-assigned-node-${nodePath}`

      if (!nodesMap.has(nodeId)) {
        const dossierStatus = parseDossierStatus(dossier.status)
        const newNode: DataTreeNodeT = {
          id: nodeId,
          name: isLast ? dossier.name || segment : segment,
          type: isLast ? 'record' : 'folder',
          parentId: currentParentId,
          children: [],
          sizeBytes: 0,
          uploadedAt: dossier.updatedAt || dossier.createdAt,
          uploadedBy: 'System',
          ...(isLast
            ? {
                entityType: 'DOCUMENT' as const,
                dossierId,
                folderId: dossier.folderId,
                isAssigned: true,
                ...(dossierStatus ? { dossierStatus } : {}),
                ...(dossier.projectCode ? { projectCode: dossier.projectCode } : {}),
                ...(dossier.requiredQcCount != null
                  ? { requiredQcCount: dossier.requiredQcCount }
                  : {}),
              }
            : {}),
        }

        nodesMap.set(nodeId, newNode)
        const parent = nodesMap.get(currentParentId)
        if (parent) {
          parent.children.push(newNode)
        }
      } else if (isLast) {
        const existing = nodesMap.get(nodeId)
        if (existing) {
          const dossierStatus = parseDossierStatus(dossier.status)
          existing.name = dossier.name || segment
          existing.dossierId = dossierId
          existing.folderId = dossier.folderId
          existing.isAssigned = true
          if (dossierStatus) existing.dossierStatus = dossierStatus
        }
      }

      currentParentId = nodeId
    }
  }

  return rootNode
}
