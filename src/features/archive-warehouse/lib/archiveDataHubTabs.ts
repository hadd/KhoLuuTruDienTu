import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'

export type ArchiveDataHubTabsInputT = {
  canReadArchiveWarehouse: boolean
  canReadDisposal: boolean
  councilReviewEnabled: boolean
  canReadCouncil: boolean
  canSubmitArchive: boolean
  canReviewArchive: boolean
  canManageArchiveConfig: boolean
  canOpenPermissionTab: boolean
}

export function resolveArchiveDataHubTabs(
  input: ArchiveDataHubTabsInputT,
): Array<ArchiveDataHubTabT> {
  const tabs: Array<ArchiveDataHubTabT> = []
  if (input.canReadArchiveWarehouse) tabs.push('dossiers')
  const canOpenDisposalModule =
    input.canReadDisposal ||
    (input.councilReviewEnabled && input.canReadCouncil)
  if (canOpenDisposalModule) tabs.push('expiryReview')
  // disposalProposal / disposalCouncil remain in the schema enum for legacy URL
  // redirects only; they are no longer top-level hub tabs.
  if (input.canSubmitArchive) tabs.push('submission')
  if (input.canReviewArchive) tabs.push('review')
  // borrow / reading / borrowReview live under Khai thác dữ liệu, not Kho dữ liệu.
  if (input.canManageArchiveConfig) tabs.push('config')
  if (input.canOpenPermissionTab) tabs.push('permission')
  return tabs
}
