import { faker } from '@faker-js/faker'
import { Store } from '@tanstack/store'

import { getChildNodeType } from '@/features/document-scan/lib/scanTreeUtils'
import { createClientId } from '@/lib/utils/id'
import type {
  ScanBranchNodeType,
  ScanPageRotationT,
  ScanPageT,
  ScanTreeNodeT,
  ScanWorkspaceT,
} from '@/features/document-scan/types'

const STORAGE_KEY = 'document-scan:workspace'

function nowIso(): string {
  return new Date().toISOString()
}

function createNode(
  type: ScanBranchNodeType,
  name: string,
  parentId: string | null,
): ScanTreeNodeT {
  const timestamp = nowIso()
  return {
    id: createClientId('scan'),
    type,
    name,
    parentId,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as ScanTreeNodeT
}

function seedWorkspace(): ScanWorkspaceT {
  const nodes: Record<string, ScanTreeNodeT> = {}
  const rootIds: Array<string> = []

  const project = createNode('project', faker.company.name(), null)
  nodes[project.id] = project
  rootIds.push(project.id)

  for (let fondIndex = 0; fondIndex < 2; fondIndex += 1) {
    const fond = createNode(
      'fond',
      `${faker.word.noun()} ${fondIndex + 1}`,
      project.id,
    )
    nodes[fond.id] = fond

    const dossierCount = faker.number.int({ min: 1, max: 2 })
    for (let dossierIndex = 0; dossierIndex < dossierCount; dossierIndex += 1) {
      const dossier = createNode(
        'dossier',
        `${faker.word.adjective()} ${dossierIndex + 1}`,
        fond.id,
      )
      nodes[dossier.id] = dossier
    }
  }

  return { nodes, pages: {}, rootIds }
}

function readPersistedWorkspace(): ScanWorkspaceT | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScanWorkspaceT
  } catch {
    return null
  }
}

function persistWorkspace(workspace: ScanWorkspaceT) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  } catch {
    // ignore persistence errors
  }
}

const scanStoreInstance = new Store<ScanWorkspaceT>(
  readPersistedWorkspace() ?? seedWorkspace(),
)

function updateWorkspace(updater: (current: ScanWorkspaceT) => ScanWorkspaceT) {
  const next = updater(scanStoreInstance.state)
  scanStoreInstance.setState(next)
  persistWorkspace(next)
}

export const scanStore = {
  subscribe: scanStoreInstance.subscribe,
  getState: () => scanStoreInstance.state,
  reset: () => {
    const seeded = seedWorkspace()
    scanStoreInstance.setState(seeded)
    persistWorkspace(seeded)
  },
}

export function createScanNode(
  parentId: string | null,
  name: string,
): ScanTreeNodeT {
  const parentType =
    parentId === null
      ? 'root'
      : (scanStoreInstance.state.nodes[parentId]?.type ?? 'root')
  const childType = getChildNodeType(parentType)

  if (!childType) {
    throw new Error('Cannot create child for this node type')
  }

  const node = createNode(childType, name.trim(), parentId)
  updateWorkspace((current) => {
    const nodes = { ...current.nodes, [node.id]: node }
    const rootIds =
      parentId === null ? [...current.rootIds, node.id] : current.rootIds

    return { ...current, nodes, rootIds }
  })

  return node
}

export function updateScanNode(id: string, name: string): ScanTreeNodeT {
  const existing = scanStoreInstance.state.nodes[id]
  if (!existing) {
    throw new Error('Node not found')
  }

  const updated: ScanTreeNodeT = {
    ...existing,
    name: name.trim(),
    updatedAt: nowIso(),
  }

  updateWorkspace((current) => ({
    ...current,
    nodes: { ...current.nodes, [id]: updated },
  }))

  return updated
}

function collectDescendantIds(
  workspace: ScanWorkspaceT,
  nodeId: string,
): Array<string> {
  const result = [nodeId]
  for (const node of Object.values(workspace.nodes)) {
    if (node.parentId === nodeId) {
      result.push(...collectDescendantIds(workspace, node.id))
    }
  }
  return result
}

export function deleteScanNode(id: string) {
  updateWorkspace((current) => {
    const removeIds = collectDescendantIds(current, id)
    const nodes = { ...current.nodes }
    const pages = { ...current.pages }

    for (const removeId of removeIds) {
      delete nodes[removeId]
    }

    for (const page of Object.values(pages)) {
      if (removeIds.includes(page.documentId)) {
        delete pages[page.id]
      }
    }

    const rootIds = current.rootIds.filter((rootId) => rootId !== id)

    return { nodes, pages, rootIds }
  })
}

function fileToMimeType(file: File): 'image/png' | 'image/jpeg' {
  return file.type === 'image/png' ? 'image/png' : 'image/jpeg'
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export async function addScanPages(
  documentId: string,
  files: Array<File>,
): Promise<Array<ScanPageT>> {
  const document = scanStoreInstance.state.nodes[documentId]
  if (document?.type !== 'document') {
    throw new Error('Document not found')
  }

  const existingPages = Object.values(scanStoreInstance.state.pages).filter(
    (page) => page.documentId === documentId,
  )
  const nextSortOrder =
    existingPages.reduce((max, page) => Math.max(max, page.sortOrder), -1) + 1

  const createdPages: Array<ScanPageT> = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const imageData = await fileToDataUrl(file)
    createdPages.push({
      id: createClientId('scan'),
      documentId,
      name:
        file.name.replace(/\.[^.]+$/, '') ||
        `Page ${nextSortOrder + index + 1}`,
      sortOrder: nextSortOrder + index,
      rotation: 0 as ScanPageRotationT,
      scale: 1,
      imageData,
      mimeType: fileToMimeType(file),
    })
  }

  updateWorkspace((current) => {
    const pages = { ...current.pages }
    for (const page of createdPages) {
      pages[page.id] = page
    }
    return { ...current, pages }
  })

  return createdPages
}

export function updateScanPage(
  pageId: string,
  patch: Partial<Pick<ScanPageT, 'name' | 'rotation' | 'scale'>>,
): ScanPageT {
  const existing = scanStoreInstance.state.pages[pageId]
  if (!existing) {
    throw new Error('Page not found')
  }

  const updated: ScanPageT = { ...existing, ...patch }
  updateWorkspace((current) => ({
    ...current,
    pages: { ...current.pages, [pageId]: updated },
  }))

  return updated
}

export function reorderScanPages(
  documentId: string,
  orderedPageIds: Array<string>,
): Array<ScanPageT> {
  const reordered: Array<ScanPageT> = orderedPageIds.map((pageId, index) => {
    const page = scanStoreInstance.state.pages[pageId]
    if (!page || page.documentId !== documentId) {
      throw new Error('Invalid page order')
    }
    return { ...page, sortOrder: index }
  })

  updateWorkspace((current) => {
    const pages = { ...current.pages }
    for (const page of reordered) {
      pages[page.id] = page
    }
    return { ...current, pages }
  })

  return reordered
}

export function deleteScanPage(pageId: string) {
  updateWorkspace((current) => {
    const page = current.pages[pageId]
    if (!page) return current

    const pages = { ...current.pages }
    delete pages[pageId]
    return { ...current, pages }
  })
}

export function uploadScanBatchRemoveNodes(nodeIds: Array<string>) {
  updateWorkspace((current) => {
    const removeIds = new Set<string>()
    for (const nodeId of nodeIds) {
      for (const descendantId of collectDescendantIds(current, nodeId)) {
        removeIds.add(descendantId)
      }
    }

    const nodes = { ...current.nodes }
    const pages = { ...current.pages }

    for (const removeId of removeIds) {
      delete nodes[removeId]
    }

    for (const page of Object.values(pages)) {
      if (removeIds.has(page.documentId)) {
        delete pages[page.id]
      }
    }

    const rootIds = current.rootIds.filter((rootId) => !removeIds.has(rootId))

    return { nodes, pages, rootIds }
  })
}
