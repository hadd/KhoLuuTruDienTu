import type { ArchiveDisposalViewT } from '@/features/archive-warehouse/schemas'
import { ARCHIVE_DISPOSAL_VIEWS } from '@/features/archive-warehouse/schemas'

function isDisposalView(value: string | undefined): value is ArchiveDisposalViewT {
  return (
    value != null &&
    (ARCHIVE_DISPOSAL_VIEWS as ReadonlyArray<string>).includes(value)
  )
}

export function isArchiveDisposalModuleActive(tab?: string): boolean {
  return tab === 'expiryReview'
}

/**
 * Resolves the active sub-view under "Hủy hồ sơ".
 * Proposal is only available when council review workflow is enabled.
 */
export function resolveArchiveDisposalView(input: {
  tab?: string
  disposalView?: string
  councilReviewEnabled: boolean
}): ArchiveDisposalViewT | undefined {
  if (!isArchiveDisposalModuleActive(input.tab)) {
    return undefined
  }

  if (
    input.disposalView === 'proposal' &&
    input.councilReviewEnabled &&
    isDisposalView(input.disposalView)
  ) {
    return 'proposal'
  }

  return 'list'
}
