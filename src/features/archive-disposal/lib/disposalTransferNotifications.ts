import type { TFunction } from 'i18next'
import { toast } from 'sonner'

import type { TransferToProposalResultT } from '@/features/archive-disposal/types'

export function notifyDisposalTransferResult(
  result: TransferToProposalResultT,
  options: {
    appendToCatalog: boolean
    t: TFunction<'archive-disposal'>
  },
) {
  const skipped = result.skippedDuplicateCount ?? 0
  const added = result.items.length

  if (added > 0) {
    toast.success(
      options.appendToCatalog
        ? options.t('disposal.appendToCatalogSuccess')
        : options.t('disposal.transferSuccess'),
    )
  }

  if (skipped > 0) {
    toast.warning(
      options.t('disposal.catalogDuplicateSkipped', { count: skipped }),
    )
  }
}

export function isAppendToDisposalCatalog(catalogId?: string | null): boolean {
  return Boolean(catalogId?.trim())
}
