import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  deleteBorrowApprovalClearance,
  getBorrowApprovalClearanceCatalog,
  replaceBorrowApprovalClearances,
} from '@/features/borrow-approval-clearance/api/borrowApprovalClearanceClient'
import type { ReplaceBorrowApprovalClearancesPayloadT } from '@/features/borrow-approval-clearance/types'
import i18n from '@/lib/i18n/config'
import { translateError } from '@/lib/utils/translate-error'

export const borrowApprovalClearanceQueryKey = [
  'admin',
  'archive-borrow-approval-clearances',
] as const

export const borrowApprovalClearanceQueryOptions = () =>
  queryOptions({
    queryKey: borrowApprovalClearanceQueryKey,
    queryFn: getBorrowApprovalClearanceCatalog,
  })

export function useReplaceBorrowApprovalClearances() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReplaceBorrowApprovalClearancesPayloadT) =>
      replaceBorrowApprovalClearances(payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(borrowApprovalClearanceQueryKey, data)
      toast.success(
        i18n.t('saveSuccess', { ns: 'borrow-approval-clearance' }),
      )
    },
    onError: (error) => {
      toast.error(
        translateError(error) ||
          i18n.t('errors.saveFailed', { ns: 'borrow-approval-clearance' }),
      )
    },
  })
}

export function useDeleteBorrowApprovalClearance() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: string) => deleteBorrowApprovalClearance(roleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: borrowApprovalClearanceQueryKey,
      })
      toast.success(
        i18n.t('deleteSuccess', { ns: 'borrow-approval-clearance' }),
      )
    },
    onError: (error) => {
      toast.error(
        translateError(error) ||
          i18n.t('errors.deleteFailed', { ns: 'borrow-approval-clearance' }),
      )
    },
  })
}
