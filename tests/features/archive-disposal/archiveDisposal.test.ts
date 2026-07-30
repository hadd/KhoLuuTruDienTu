import { describe, expect, it } from 'vitest'

import {
  hasArchiveDisposalCreatePermission,
  hasArchiveDisposalManagePermission,
  hasArchiveDisposalSubmitPermission,
  hasArchiveDisposalUpdatePermission,
} from '@/features/archive-disposal/lib/archiveDisposalAccess'
import type { DisposalCandidateCategoryT } from '@/features/archive-disposal/types'

import {
  buildDisposalCandidateListParams,
  countDisposalCandidateFilters,
  hasDisposalCandidateFilters,
} from '@/features/archive-disposal/lib/disposalCandidateParams'
import {
  shouldShowWarehousePickerSelection,
  shouldShowWarehouseRowSelection,
} from '@/features/archive-disposal/lib/warehousePickerSelection'

function buildCandidateParams(category: DisposalCandidateCategoryT) {
  return {
    category,
    entityKind: 'dossier' as const,
    page: 1,
    limit: 20,
  }
}

describe('archive disposal permissions', () => {
  it('splits manage into create/update/submit', () => {
    expect(
      hasArchiveDisposalCreatePermission(['archive.disposal.create']),
    ).toBe(true)
    expect(
      hasArchiveDisposalUpdatePermission(['archive.disposal.update']),
    ).toBe(true)
    expect(
      hasArchiveDisposalSubmitPermission(['archive.disposal.submit']),
    ).toBe(true)
    expect(hasArchiveDisposalManagePermission(['archive.disposal.create'])).toBe(
      true,
    )
    expect(
      hasArchiveDisposalManagePermission(['archive.disposal.read']),
    ).toBe(false)
  })

  it('maps legacy manage to all write permissions', () => {
    const legacy = ['archive.disposal.manage']
    expect(hasArchiveDisposalCreatePermission(legacy)).toBe(true)
    expect(hasArchiveDisposalUpdatePermission(legacy)).toBe(true)
    expect(hasArchiveDisposalSubmitPermission(legacy)).toBe(true)
  })
})

describe('warehouse picker selection', () => {
  it('shows picker checkboxes only when catalog is selected', () => {
    expect(
      shouldShowWarehousePickerSelection({
        pickerMode: true,
        councilReviewEnabled: true,
        canUpdateDisposal: true,
        disposalCatalogId: 'catalog-1',
        isEsSearchActive: false,
      }),
    ).toBe(true)

    expect(
      shouldShowWarehousePickerSelection({
        pickerMode: true,
        councilReviewEnabled: true,
        canUpdateDisposal: true,
        disposalCatalogId: null,
        isEsSearchActive: false,
      }),
    ).toBe(false)
  })

  it('hides picker when council review workflow is disabled', () => {
    expect(
      shouldShowWarehousePickerSelection({
        pickerMode: true,
        councilReviewEnabled: false,
        canUpdateDisposal: true,
        disposalCatalogId: 'catalog-1',
        isEsSearchActive: false,
      }),
    ).toBe(false)
  })

  it('combines export and picker selection columns', () => {
    expect(
      shouldShowWarehouseRowSelection({
        showDownload: false,
        showPickerSelection: true,
      }),
    ).toBe(true)

    expect(
      shouldShowWarehouseRowSelection({
        showDownload: false,
        showPickerSelection: false,
      }),
    ).toBe(false)
  })
})

describe('archive disposal candidate params', () => {
  it('maps category filter values', () => {
    expect(buildCandidateParams('expiring_soon').category).toBe('expiring_soon')
    expect(buildCandidateParams('expired').category).toBe('expired')
    expect(buildCandidateParams('duplicate').category).toBe('duplicate')
    expect(buildCandidateParams('all').category).toBe('all')
  })

  it('builds API params from hub search including filters', () => {
    const params = buildDisposalCandidateListParams({
      tab: 'expiryReview',
      disposalCategory: 'expired',
      searchFondId: 'fond-1',
      disposalRetentionPeriodId: 'ret-1',
      physicalItemId: 'box-1',
      disposalDateFrom: '2026-01-01',
      disposalDateTo: '2026-12-31',
      q: '  HS-001  ',
      page: 2,
      limit: 50,
    })

    expect(params).toEqual({
      category: 'expired',
      entityKind: 'grouped',
      fondId: 'fond-1',
      dossierTypeId: undefined,
      documentTypeId: undefined,
      retentionPeriodId: 'ret-1',
      physicalItemId: 'box-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      search: 'HS-001',
      page: 2,
      limit: 50,
    })
  })

  it('always requests grouped candidates for expiry review', () => {
    expect(
      buildDisposalCandidateListParams({
        tab: 'expiryReview',
        disposalEntityKind: 'document',
      }).entityKind,
    ).toBe('grouped')
  })

  it('detects active disposal filters', () => {
    expect(hasDisposalCandidateFilters({ tab: 'expiryReview' })).toBe(false)
    expect(
      hasDisposalCandidateFilters({
        tab: 'expiryReview',
        disposalCategory: 'all',
      }),
    ).toBe(false)
    expect(
      hasDisposalCandidateFilters({
        tab: 'expiryReview',
        physicalItemId: 'box-1',
      }),
    ).toBe(true)
    expect(
      hasDisposalCandidateFilters({
        tab: 'expiryReview',
        q: 'test',
      }),
    ).toBe(true)
  })

  it('counts sheet filters excluding default category and search', () => {
    expect(countDisposalCandidateFilters({ tab: 'expiryReview' })).toBe(0)
    expect(
      countDisposalCandidateFilters({
        tab: 'expiryReview',
        disposalCategory: 'expired',
        searchFondId: 'fond-1',
        disposalDateFrom: '2026-01-01',
      }),
    ).toBe(3)
  })
})

describe('disposal selection keys', () => {
  it('builds stable dossier selection keys', () => {
    const key = (dossierId: string, fileId?: string | null) =>
      fileId ? `${dossierId}:${fileId}` : dossierId

    expect(key('d1')).toBe('d1')
    expect(key('d1', 'f1')).toBe('d1:f1')
  })
})
