import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { transferToDisposalProposal } from '@/features/archive-disposal/api/archiveDisposalClient'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import {
  shouldShowWarehousePickerSelection,
  shouldShowWarehouseRowSelection,
} from '@/features/archive-disposal/lib/warehousePickerSelection'
import type { TransferToProposalItemT } from '@/features/archive-disposal/types'
import { translateError } from '@/lib/utils/translate-error'

type UseWarehouseDisposalPickerInput = {
  pickerMode?: boolean
  disposalCatalogId?: string | null
  isEsSearchActive?: boolean
  showDownload?: boolean
  onTransferSuccess?: () => void
}

export function useWarehouseDisposalPicker(input: UseWarehouseDisposalPickerInput) {
  const { t: tDisposal } = useTranslation('archive-disposal')
  const navigate = useNavigate()
  const { canUpdateDisposal } = useArchiveDisposalAccess()

  const showPickerSelection = shouldShowWarehousePickerSelection({
    pickerMode: input.pickerMode === true,
    canUpdateDisposal,
    disposalCatalogId: input.disposalCatalogId,
    isEsSearchActive: input.isEsSearchActive ?? false,
  })

  const showRowSelection = shouldShowWarehouseRowSelection({
    showDownload: input.showDownload ?? false,
    showPickerSelection,
  })

  const pickerTransferMutation = useMutation({
    mutationFn: transferToDisposalProposal,
    onSuccess: () => {
      toast.success(tDisposal('disposal.transferSuccess'))
      input.onTransferSuccess?.()
      void navigate({
        to: '/app/archive-warehouse',
        search: {
          tab: 'disposalProposal',
          disposalCatalogId: input.disposalCatalogId ?? undefined,
          page: 1,
        },
      })
    },
    onError: (error) => {
      toast.error(translateError(error))
    },
  })

  function transferItems(items: Array<TransferToProposalItemT>) {
    if (!input.disposalCatalogId) return
    pickerTransferMutation.mutate({
      catalogId: input.disposalCatalogId,
      items,
    })
  }

  return {
    showPickerSelection,
    showRowSelection,
    pickerTransferMutation,
    transferItems,
  }
}
