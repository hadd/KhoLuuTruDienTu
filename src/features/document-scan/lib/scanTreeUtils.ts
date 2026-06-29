import type {
  ScanBranchNodeType,
  ScanDocumentT,
  ScanPageT,
  ScanTreeBranchT,
  ScanTreeNodeT,
  ScanWorkspaceT,
} from '@/features/document-scan/types'

const CHILD_TYPE_MAP: Record<
  ScanBranchNodeType | 'root',
  ScanBranchNodeType | null
> = {
  root: 'project',
  project: 'fond',
  fond: 'dossier',
  dossier: 'document',
  document: null,
}

export function getChildNodeType(
  parentType: ScanBranchNodeType | 'root',
): ScanBranchNodeType | null {
  return CHILD_TYPE_MAP[parentType]
}

export function findNodeById(
  workspace: ScanWorkspaceT,
  id: string,
): ScanTreeNodeT | null {
  return workspace.nodes[id] ?? null
}

export function findPageById(
  workspace: ScanWorkspaceT,
  id: string,
): ScanPageT | null {
  return workspace.pages[id] ?? null
}

export function resolveSelectedItem(
  workspace: ScanWorkspaceT,
  selectedId: string | undefined,
):
  | { kind: 'node'; node: ScanTreeNodeT }
  | { kind: 'page'; page: ScanPageT; document: ScanDocumentT }
  | null {
  if (!selectedId) return null

  const page = workspace.pages[selectedId]
  if (page) {
    const document = workspace.nodes[page.documentId]
    if (document?.type === 'document') {
      return { kind: 'page', page, document }
    }
    return null
  }

  const node = workspace.nodes[selectedId]
  if (node) {
    return { kind: 'node', node }
  }

  return null
}

export function buildScanTree(
  workspace: ScanWorkspaceT,
): Array<ScanTreeBranchT> {
  const buildBranch = (nodeId: string): ScanTreeBranchT | null => {
    const node = workspace.nodes[nodeId]
    if (!node) return null

    const childIds = Object.values(workspace.nodes)
      .filter((item) => item.parentId === nodeId)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((item) => item.id)

    const children = childIds
      .map((childId) => buildBranch(childId))
      .filter((child): child is ScanTreeBranchT => child !== null)

    return { ...node, children }
  }

  return workspace.rootIds
    .map((rootId) => buildBranch(rootId))
    .filter((branch): branch is ScanTreeBranchT => branch !== null)
}

export function getPathToNode(
  workspace: ScanWorkspaceT,
  nodeId: string,
): Array<ScanTreeNodeT> {
  const path: Array<ScanTreeNodeT> = []
  let current = workspace.nodes[nodeId]

  while (current) {
    path.unshift(current)
    if (!current.parentId) break
    current = workspace.nodes[current.parentId]
  }

  return path
}

export function collectDescendantNodeIds(
  workspace: ScanWorkspaceT,
  nodeId: string,
): Array<string> {
  const result: Array<string> = [nodeId]
  const children = Object.values(workspace.nodes).filter(
    (node) => node.parentId === nodeId,
  )

  for (const child of children) {
    result.push(...collectDescendantNodeIds(workspace, child.id))
  }

  return result
}

export function collectDocumentsUnderNodes(
  workspace: ScanWorkspaceT,
  nodeIds: Array<string>,
): Array<ScanDocumentT> {
  const documentIds = new Set<string>()

  for (const nodeId of nodeIds) {
    for (const descendantId of collectDescendantNodeIds(workspace, nodeId)) {
      const node = workspace.nodes[descendantId]
      if (node?.type === 'document') {
        documentIds.add(node.id)
      }
    }
  }

  return [...documentIds]
    .map((id) => workspace.nodes[id])
    .filter((node): node is ScanDocumentT => node?.type === 'document')
}

export function getPagesForDocument(
  workspace: ScanWorkspaceT,
  documentId: string,
): Array<ScanPageT> {
  return Object.values(workspace.pages)
    .filter((page) => page.documentId === documentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export function countUploadBatchStats(
  workspace: ScanWorkspaceT,
  checkedNodeIds: Array<string>,
): { documentCount: number; pageCount: number } {
  const documents = collectDocumentsUnderNodes(workspace, checkedNodeIds)
  const pageCount = documents.reduce(
    (total, document) => total + getPagesForDocument(workspace, document.id).length,
    0,
  )

  return {
    documentCount: documents.length,
    pageCount,
  }
}

export function canCheckNode(node: ScanTreeNodeT): boolean {
  return node.type === 'project' || node.type === 'fond' || node.type === 'dossier'
}

export function collectSubtreePageBlobUrls(
  workspace: ScanWorkspaceT,
  nodeIds: Array<string>,
): Array<string> {
  const documents = collectDocumentsUnderNodes(workspace, nodeIds)
  const imageSources: Array<string> = []

  for (const document of documents) {
    for (const page of getPagesForDocument(workspace, document.id)) {
      imageSources.push(page.imageData)
    }
  }

  return imageSources
}
