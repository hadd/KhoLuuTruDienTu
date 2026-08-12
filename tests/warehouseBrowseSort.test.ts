import { describe, expect, it } from 'vitest'

import { toggleWarehouseBrowseSort } from '@/features/archive-warehouse/lib/warehouseBrowseSort'

describe('warehouseBrowseSort', () => {
  it('starts ascending when switching sort column', () => {
    expect(toggleWarehouseBrowseSort({}, 'fondName')).toEqual({
      sortBy: 'fondName',
      sortDir: 'asc',
    })
  })

  it('toggles direction on the same column', () => {
    expect(
      toggleWarehouseBrowseSort(
        { sortBy: 'dossierTypeName', sortDir: 'asc' },
        'dossierTypeName',
      ),
    ).toEqual({
      sortBy: 'dossierTypeName',
      sortDir: 'desc',
    })
  })
})
