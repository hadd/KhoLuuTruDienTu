import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'

export type ArchiveDataHubTabsInputT = {
  canReadArchiveWarehouse: boolean
  canReadDisposal: boolean
  councilReviewEnabled: boolean
  canReadCouncil: boolean
  canSubmitArchive: boolean
  canReviewArchive: boolean
  canRequestBorrow: boolean
  canReadBorrow: boolean
  canReviewBorrow: boolean
  canManageArchiveConfig: boolean
  canOpenPermissionTab: boolean
}

export function resolveArchiveDataHubTabs(
  input: ArchiveDataHubTabsInputT,
): Array<ArchiveDataHubTabT> {
  const tabs: Array<ArchiveDataHubTabT> = []
  if (input.canReadArchiveWarehouse) tabs.push('dossiers')
  if (input.canReadDisposal) tabs.push('expiryReview')
  // disposalProposal / disposalCouncil remain in the schema enum for legacy URL
  // redirects only; they are no longer top-level hub tabs.
  if (input.canSubmitArchive) tabs.push('submission')
  if (input.canReviewArchive) tabs.push('review')
  if (input.canRequestBorrow) tabs.push('borrow')
  if (input.canReadBorrow) tabs.push('reading')
  if (input.canReviewBorrow) tabs.push('borrowReview')
  if (input.canManageArchiveConfig) tabs.push('config')
  if (input.canOpenPermissionTab) tabs.push('permission')
  return tabs
}
