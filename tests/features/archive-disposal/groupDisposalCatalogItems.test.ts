import { describe, expect, it } from 'vitest'

import { groupDisposalCatalogItems } from '@/features/archive-disposal/lib/groupDisposalCatalogItems'
import type { DisposalProposalItemT } from '@/features/archive-disposal/types'

function item(
  overrides: Partial<DisposalProposalItemT> & Pick<DisposalProposalItemT, 'id' | 'dossierId'>,
): DisposalProposalItemT {
  return {
    fileId: null,
    source: 'EXPIRED',
    reason: '',
    notes: '',
    ...overrides,
  }
}

describe('groupDisposalCatalogItems', () => {
  it('groups dossier and document items under the same dossier', () => {
    const groups = groupDisposalCatalogItems([
      item({
        id: 'd1',
        dossierId: 'hs-1',
        dossierName: 'Ho so A',
      }),
      item({
        id: 'f1',
        dossierId: 'hs-1',
        dossierName: 'Ho so A',
        fileId: 'file-1',
        fileName: 'Tai lieu 1.pdf',
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.dossierItem?.id).toBe('d1')
    expect(groups[0]?.documentItems).toHaveLength(1)
    expect(groups[0]?.documentItems[0]?.id).toBe('f1')
  })

  it('creates header group when only documents exist', () => {
    const groups = groupDisposalCatalogItems([
      item({
        id: 'f1',
        dossierId: 'hs-2',
        dossierName: 'Ho so B',
        fileId: 'file-1',
        fileName: 'Doc.pdf',
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.dossierItem).toBeNull()
    expect(groups[0]?.documentItems).toHaveLength(1)
  })
})
