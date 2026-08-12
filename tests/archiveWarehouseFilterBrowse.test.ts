import { describe, expect, it } from 'vitest'

import {
  isDbBrowseWarehouseFilter,
  isDossierTypeOnlyWarehouseFilter,
  isEsWarehouseSearchRequired,
  isFlatWarehouseListBrowse,
  isFondOnlyWarehouseFilter,
} from '@/features/archive-warehouse/components/ArchiveWarehouseSearchFilters'

describe('warehouse filter browse mode', () => {
  it('uses BE browse for one or many fond filters', () => {
    expect(isDbBrowseWarehouseFilter({ searchFondId: 'fond-1' })).toBe(true)
    expect(isDbBrowseWarehouseFilter({ searchFondId: ['fond-1', 'fond-2'] })).toBe(
      true,
    )
    expect(isEsWarehouseSearchRequired({ searchFondId: 'fond-1' })).toBe(false)
  })

  it('uses BE browse for one or many dossier type filters', () => {
    expect(isDbBrowseWarehouseFilter({ dossierTypeId: 'type-1' })).toBe(true)
    expect(
      isDbBrowseWarehouseFilter({ dossierTypeId: ['type-1', 'type-2'] }),
    ).toBe(true)
    expect(isDossierTypeOnlyWarehouseFilter({ dossierTypeId: 'type-1' })).toBe(
      true,
    )
  })

  it('uses BE browse when fond and dossier type are both selected', () => {
    const values = { searchFondId: 'fond-1', dossierTypeId: 'type-1' }
    expect(isDbBrowseWarehouseFilter(values)).toBe(true)
    expect(isFondOnlyWarehouseFilter(values)).toBe(false)
    expect(isDossierTypeOnlyWarehouseFilter(values)).toBe(false)
  })

  it('uses ES for document type or metadata filters', () => {
    expect(isEsWarehouseSearchRequired({ documentTypeId: 'doc-1' })).toBe(true)
    expect(isEsWarehouseSearchRequired({ editorName: 'Nguyen' })).toBe(true)
    expect(isDbBrowseWarehouseFilter({ documentTypeId: 'doc-1' })).toBe(false)
  })

  it('uses flat BE list when manage-by-fond is off and no filters apply', () => {
    expect(isFlatWarehouseListBrowse(false, {})).toBe(true)
    expect(isFlatWarehouseListBrowse(true, {})).toBe(false)
    expect(isFlatWarehouseListBrowse(false, { searchFondId: 'fond-1' })).toBe(
      false,
    )
    expect(isFlatWarehouseListBrowse(false, { dossierTypeId: 'type-1' })).toBe(
      false,
    )
    expect(isFlatWarehouseListBrowse(false, { editorName: 'Nguyen' })).toBe(
      false,
    )
  })
})
