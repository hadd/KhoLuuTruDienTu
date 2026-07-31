import { describe, expect, it } from 'vitest'

import { resolveArchiveDisposalView } from '@/features/archive-warehouse/lib/resolveArchiveDisposalView'

describe('resolveArchiveDisposalView', () => {
  it('returns undefined when not on the disposal module', () => {
    expect(
      resolveArchiveDisposalView({
        tab: 'dossiers',
        disposalView: 'proposal',
        councilReviewEnabled: true,
      }),
    ).toBeUndefined()
  })

  it('defaults to list when disposalView is missing', () => {
    expect(
      resolveArchiveDisposalView({
        tab: 'expiryReview',
        councilReviewEnabled: true,
      }),
    ).toBe('list')
  })

  it('returns proposal when enabled and requested', () => {
    expect(
      resolveArchiveDisposalView({
        tab: 'expiryReview',
        disposalView: 'proposal',
        councilReviewEnabled: true,
      }),
    ).toBe('proposal')
  })

  it('falls back to list when proposal is requested but council review is off', () => {
    expect(
      resolveArchiveDisposalView({
        tab: 'expiryReview',
        disposalView: 'proposal',
        councilReviewEnabled: false,
      }),
    ).toBe('list')
  })
})
