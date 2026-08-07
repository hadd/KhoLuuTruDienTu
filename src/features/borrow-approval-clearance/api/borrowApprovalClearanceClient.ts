import { apiClient } from '@/lib/api/apiClient'

import type {
  BorrowApprovalClearanceCatalogT,
  ReplaceBorrowApprovalClearancesPayloadT,
} from '@/features/borrow-approval-clearance/types'

const BASE_PATH = '/api/v1/admin/archive-borrow-approval-clearances'

export async function getBorrowApprovalClearanceCatalog(): Promise<BorrowApprovalClearanceCatalogT> {
  const response = await apiClient.get<BorrowApprovalClearanceCatalogT>(BASE_PATH)
  return response.data
}

export async function replaceBorrowApprovalClearances(
  payload: ReplaceBorrowApprovalClearancesPayloadT,
): Promise<BorrowApprovalClearanceCatalogT> {
  const response = await apiClient.put<BorrowApprovalClearanceCatalogT>(
    BASE_PATH,
    payload,
  )
  return response.data
}

export async function deleteBorrowApprovalClearance(
  roleId: string,
): Promise<void> {
  await apiClient.delete(`${BASE_PATH}/${encodeURIComponent(roleId)}`)
}
