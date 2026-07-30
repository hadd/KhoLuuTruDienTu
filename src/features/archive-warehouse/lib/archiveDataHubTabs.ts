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
  if (input.canReadDisposal) tabs.push('expiryReview')
  if (input.councilReviewEnabled && input.canReadDisposal) {
    tabs.push('disposalProposal')
  }
  if (input.councilReviewEnabled && input.canReadCouncil) {
    tabs.push('disposalCouncil')
  }
  if (input.canSubmitArchive) tabs.push('submission')
  if (input.canReviewArchive) tabs.push('review')
  if (input.canManageArchiveConfig) tabs.push('config')
  if (input.canOpenPermissionTab) tabs.push('permission')
  return tabs
}
