import type {
  CreatePaperSizePayloadT,
  PaperSizesListResponseT,
  PaperSizeT,
} from '@/features/plan-management/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

const BASE_PATH = '/api/v1/paper-sizes'

function unwrapPaperSize(
  data: SingleResourceResponse<PaperSizeT> | PaperSizeT | { data: PaperSizeT },
): PaperSizeT {
  if (data && typeof data === 'object') {
    if ('record' in data) {
      return data.record
    }
    if ('data' in data && data.data && typeof data.data === 'object') {
      return data.data
    }
  }

  return data as PaperSizeT
}

export const getPaperSizes = async (): Promise<PaperSizesListResponseT> => {
  const response = await apiClient.get<PaperSizesListResponseT>(BASE_PATH)
  return response.data
}

export const createPaperSize = async (
  payload: CreatePaperSizePayloadT,
): Promise<PaperSizeT> => {
  const response = await apiClient.post<
    SingleResourceResponse<PaperSizeT> | PaperSizeT
  >(BASE_PATH, payload)
  return unwrapPaperSize(response.data)
}
