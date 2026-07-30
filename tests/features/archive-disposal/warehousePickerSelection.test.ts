import { describe, expect, it } from 'vitest'

import {
  buildWarehousePickerRouteSearch,
  shouldShowWarehousePickerSelection,
} from '@/features/archive-disposal/lib/warehousePickerSelection'

describe('shouldShowWarehousePickerSelection', () => {
  it('requires council review to be enabled', () => {
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
})

describe('buildWarehousePickerRouteSearch', () => {
  it('returns picker params when picker mode is active', () => {
    expect(
      buildWarehousePickerRouteSearch({
        pickerMode: true,
        disposalCatalogId: 'catalog-1',
        page: 1,
      }),
    ).toEqual({
      pickerMode: true,
      disposalCatalogId: 'catalog-1',
      page: 1,
    })
  })

  it('returns empty object when picker mode is inactive', () => {
    expect(
      buildWarehousePickerRouteSearch({
        pickerMode: false,
        disposalCatalogId: 'catalog-1',
      }),
    ).toEqual({})
  })
})
