import { describe, expect, it } from 'vitest'

import { resolveArchiveDataHubTabs } from '@/features/archive-warehouse/lib/archiveDataHubTabs'

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

  it('hides the disposal module when the user cannot read disposal', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        canReadDisposal: false,
      }),
    ).toEqual(['dossiers'])
  })
})
