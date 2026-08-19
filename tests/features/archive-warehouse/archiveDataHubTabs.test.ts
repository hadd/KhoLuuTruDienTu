import { describe, expect, it } from 'vitest'

import { resolveArchiveDataHubTabs } from '@/features/archive-warehouse/lib/archiveDataHubTabs'
import {
  ARCHIVE_DATA_HUB_RELATED_PATHS,
  WAREHOUSE_MANAGEMENT_RELATED_PATHS,
} from '@/features/archive-warehouse/lib/archiveWarehouseAccess'

const baseInput = {
  canReadArchiveWarehouse: true,
  canReadDisposal: true,
  councilReviewEnabled: true,
  canReadCouncil: true,
  canSubmitArchive: false,
  canReviewArchive: false,
  canManageArchiveConfig: false,
  canOpenPermissionTab: false,
}

describe('resolveArchiveDataHubTabs', () => {
  it('keeps a single disposal module tab when council review is enabled', () => {
    expect(resolveArchiveDataHubTabs(baseInput)).toEqual([
      'dossiers',
      'expiryReview',
    ])
  })

  it('still shows the disposal module tab when council review is disabled', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        councilReviewEnabled: false,
      }),
    ).toEqual(['dossiers', 'expiryReview'])
  })

  it('shows disposal module for council read without disposal read', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        canReadDisposal: false,
        canReadCouncil: true,
        councilReviewEnabled: true,
      }),
    ).toEqual(['dossiers', 'expiryReview'])
  })

  it('hides the disposal module when the user cannot read disposal', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        canReadDisposal: false,
        canReadCouncil: false,
      }),
    ).toEqual(['dossiers'])
  })

  it('does not open Kho dữ liệu for library/exploitation permissions', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        canReadArchiveWarehouse: false,
        canReadDisposal: false,
        canReadCouncil: false,
      }),
    ).toEqual([])
  })
})

describe('ARCHIVE_DATA_HUB_RELATED_PATHS', () => {
  it('keeps warehouse hub paths without library borrow routes', () => {
    expect(ARCHIVE_DATA_HUB_RELATED_PATHS).toContain('/app/archive-warehouse')
    expect(ARCHIVE_DATA_HUB_RELATED_PATHS).not.toContain('/app/archive-borrow')
    expect(WAREHOUSE_MANAGEMENT_RELATED_PATHS).not.toContain(
      '/app/archive-borrow',
    )
  })
})
