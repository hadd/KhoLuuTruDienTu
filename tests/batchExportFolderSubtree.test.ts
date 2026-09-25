import { describe, expect, it } from 'vitest'

import {
  isBatchExportDossierLeafNode,
  isBatchExportSelectableNode,
} from '@/features/data-management/lib/treeUtils'
import type { DataTreeNodeT } from '@/features/data-management/types'

function folderNode(
  overrides: Partial<DataTreeNodeT> & Pick<DataTreeNodeT, 'id' | 'name'>,
): DataTreeNodeT {
  return {
    type: 'folder',
    parentId: 'parent',
    children: [],
    ...overrides,
  }
}

function recordNode(
  overrides: Partial<DataTreeNodeT> & Pick<DataTreeNodeT, 'id' | 'name'>,
): DataTreeNodeT {
  return {
    type: 'record',
    parentId: 'parent',
    children: [],
    ...overrides,
  }
}

describe('batch export folder vs dossier leaf', () => {
  it('treats folder-shaped READY_FOR_ENTRY dossier as selectable subtree with bypass', () => {
    const node = folderNode({
      id: 'folder-1',
      name: 'test123',
      dossierId: 'dossier-1',
      dossierStatus: 'READY_FOR_ENTRY',
      entityType: 'DOCUMENT',
    })

    expect(isBatchExportDossierLeafNode(node, { bypassStatus: true })).toBe(
      false,
    )
    expect(isBatchExportSelectableNode(node, { bypassStatus: true })).toBe(true)
  })

  it('blocks folder-shaped READY_FOR_ENTRY without bypass', () => {
    const node = folderNode({
      id: 'folder-1',
      name: 'test123',
      dossierId: 'dossier-1',
      dossierStatus: 'READY_FOR_ENTRY',
      entityType: 'DOCUMENT',
    })

    expect(isBatchExportDossierLeafNode(node)).toBe(false)
    expect(isBatchExportSelectableNode(node)).toBe(false)
  })

  it('allows APPROVED folder-shaped dossier as subtree without bypass', () => {
    const node = folderNode({
      id: 'folder-2',
      name: 'approved-folder',
      dossierId: 'dossier-2',
      dossierStatus: 'APPROVED',
      entityType: 'DOCUMENT',
    })

    expect(isBatchExportDossierLeafNode(node)).toBe(false)
    expect(isBatchExportSelectableNode(node)).toBe(true)
  })

  it('keeps APPROVED record as dossier leaf', () => {
    const node = recordNode({
      id: 'record-1',
      name: 'hoso',
      dossierId: 'dossier-3',
      dossierStatus: 'APPROVED',
      entityType: 'DOCUMENT',
    })

    expect(isBatchExportDossierLeafNode(node)).toBe(true)
    expect(isBatchExportSelectableNode(node)).toBe(true)
  })

  it('allows pure container folder as subtree', () => {
    const node = folderNode({
      id: 'container-1',
      name: 'container',
      entityType: 'FOLDER',
    })

    expect(isBatchExportDossierLeafNode(node)).toBe(false)
    expect(isBatchExportSelectableNode(node)).toBe(true)
  })
})
