import { isAxiosError } from 'axios'

import type {
  CreateWatermarkPlacementPayloadT,
  UpdateWatermarkPlacementPayloadT,
  WatermarkImageRecordT,
  WatermarkPlacementRecordT,
  WatermarkPlacementSummaryT,
} from '@/features/watermark-config/types'
import { apiClient } from '@/lib/api/apiClient'

const BASE_PATH = '/api/v1/admin/watermark'

export class WatermarkConfigApiError extends Error {
  constructor(
    message: string,
    readonly code: 'notFound' | 'validation' | 'conflict' | 'unknown',
    readonly details?: string,
  ) {
    super(message)
    this.name = 'WatermarkConfigApiError'
  }
}

function parseApiError(error: unknown): WatermarkConfigApiError {
  if (isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as
      | { message?: string; error?: string }
      | undefined
    const message = data?.message ?? data?.error ?? error.message

    if (status === 404) {
      return new WatermarkConfigApiError(
        'watermarkConfigNotFound',
        'notFound',
        message,
      )
    }
    if (status === 409) {
      return new WatermarkConfigApiError(message, 'conflict', message)
    }
    if (status === 400) {
      return new WatermarkConfigApiError(message, 'validation', message)
    }
  }

  if (error instanceof Error) {
    return new WatermarkConfigApiError(error.message, 'unknown')
  }

  return new WatermarkConfigApiError('watermarkConfigSaveFailed', 'unknown')
}

export async function listWatermarkPlacements(): Promise<
  Array<WatermarkPlacementSummaryT>
> {
  const response = await apiClient.get<Array<WatermarkPlacementSummaryT>>(
    `${BASE_PATH}/placements`,
  )
  return response.data
}

export async function getWatermarkPlacement(
  placementId: string,
): Promise<WatermarkPlacementRecordT> {
  const response = await apiClient.get<WatermarkPlacementRecordT>(
    `${BASE_PATH}/placements/${placementId}`,
  )
  return response.data
}

export async function createWatermarkPlacement(
  payload: CreateWatermarkPlacementPayloadT,
): Promise<WatermarkPlacementRecordT> {
  try {
    const response = await apiClient.post<WatermarkPlacementRecordT>(
      `${BASE_PATH}/placements`,
      payload,
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function updateWatermarkPlacement(
  placementId: string,
  payload: UpdateWatermarkPlacementPayloadT,
): Promise<WatermarkPlacementRecordT> {
  try {
    const response = await apiClient.put<WatermarkPlacementRecordT>(
      `${BASE_PATH}/placements/${placementId}`,
      payload,
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function setWatermarkPlacementActive(
  placementId: string,
  isActive: boolean,
): Promise<WatermarkPlacementRecordT> {
  try {
    const response = await apiClient.patch<WatermarkPlacementRecordT>(
      `${BASE_PATH}/placements/${placementId}/active`,
      { isActive },
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function deleteWatermarkPlacement(
  placementId: string,
): Promise<void> {
  try {
    await apiClient.delete(`${BASE_PATH}/placements/${placementId}`)
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function listWatermarkImages(): Promise<
  Array<WatermarkImageRecordT>
> {
  const response = await apiClient.get<Array<WatermarkImageRecordT>>(
    `${BASE_PATH}/images`,
  )
  return response.data
}

export async function uploadWatermarkImage(
  file: File,
): Promise<WatermarkImageRecordT> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.postForm<WatermarkImageRecordT>(
      `${BASE_PATH}/images`,
      formData,
    )
    return response.data
  } catch (error) {
    throw parseApiError(error)
  }
}

export async function deleteWatermarkImage(assetId: string): Promise<void> {
  try {
    await apiClient.delete(`${BASE_PATH}/images/${assetId}`)
  } catch (error) {
    throw parseApiError(error)
  }
}
