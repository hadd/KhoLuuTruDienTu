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
  it('includes disposal proposal and council tabs when council review is enabled', () => {
    expect(resolveArchiveDataHubTabs(baseInput)).toEqual([
      'dossiers',
      'expiryReview',
      'disposalProposal',
      'disposalCouncil',
    ])
  })

  it('hides disposal proposal and council tabs when council review is disabled', () => {
    expect(
      resolveArchiveDataHubTabs({
        ...baseInput,
        councilReviewEnabled: false,
      }),
    ).toEqual(['dossiers', 'expiryReview'])
  })
})
