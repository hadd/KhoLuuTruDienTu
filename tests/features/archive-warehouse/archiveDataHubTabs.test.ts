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
  canRequestBorrow: false,
  canReviewBorrow: false,
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

  it('hides the disposal module when the user cannot read disposal', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        canReadDisposal: false,
      }),
    ).toEqual(['dossiers'])
  })

  it('includes borrow tabs when request/review permissions are granted', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        canReadArchiveWarehouse: false,
        canReadDisposal: false,
        canReadCouncil: false,
        canRequestBorrow: true,
        canReviewBorrow: true,
      }),
    ).toEqual(['borrow', 'borrowReview'])
  })
})

describe('ARCHIVE_DATA_HUB_RELATED_PATHS', () => {
  it('whitelists archive-borrow viewer path for sidebar gate', () => {
    expect(ARCHIVE_DATA_HUB_RELATED_PATHS).toContain('/app/archive-borrow')
    expect(WAREHOUSE_MANAGEMENT_RELATED_PATHS).toContain('/app/archive-borrow')
  })
})
