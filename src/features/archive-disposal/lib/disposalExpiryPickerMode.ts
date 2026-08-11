import type { DisposalProposalCatalogStatusT } from '@/features/archive-disposal/types'

export function isExpiryAppendToCatalogMode(input: {
  disposalAppendCatalogId?: string | null
  catalogStatus?: DisposalProposalCatalogStatusT | null
  councilReviewEnabled: boolean
  canUpdateDisposal: boolean
}): boolean {
  return (
    input.councilReviewEnabled &&
    input.canUpdateDisposal &&
    Boolean(input.disposalAppendCatalogId?.trim()) &&
    input.catalogStatus === 'DRAFT'
  )
}
