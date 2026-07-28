import { apiClient } from '@/lib/api/apiClient'
import type {
  OcrPendingDossiersResultT,
  OcrTrackedDossiersResultT,
  OcrTrackedUiStatusT,
  OcrTriggerResponseT,
} from '@/features/ocr-control/types'

export interface FetchPendingManualDossiersParamsT {
  page?: number
  pageSize?: number
  projectCode?: string
  folderPath?: string
}

export async function fetchPendingManualDossiers(
  params?: FetchPendingManualDossiersParamsT,
): Promise<OcrPendingDossiersResultT> {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(params?.page ?? 1))
  searchParams.set('pageSize', String(params?.pageSize ?? 20))
  if (params?.projectCode) {
    searchParams.set('projectCode', params.projectCode)
  }
  if (params?.folderPath) {
    searchParams.set('folderPath', params.folderPath)
  }

  const queryString = searchParams.toString()
  const response = await apiClient.get<OcrPendingDossiersResultT>(
    `/api/v1/dossiers/ocr-control/pending-manual${queryString ? `?${queryString}` : ''}`,
  )
  return response.data
}

export async function triggerManualOcr(
  dossierIds: Array<string>,
): Promise<OcrTriggerResponseT> {
  const response = await apiClient.post<OcrTriggerResponseT>(
    '/api/v1/dossiers/ocr-control/trigger',
    { dossierIds },
  )
  return response.data
}

export interface FetchTrackedManualDossiersParamsT {
  page?: number
  pageSize?: number
  projectCode?: string
  folderPath?: string
  uiStatus?: OcrTrackedUiStatusT
}

export async function fetchTrackedManualDossiers(
  params?: FetchTrackedManualDossiersParamsT,
): Promise<OcrTrackedDossiersResultT> {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(params?.page ?? 1))
  searchParams.set('pageSize', String(params?.pageSize ?? 20))
  if (params?.projectCode) {
    searchParams.set('projectCode', params.projectCode)
  }
  if (params?.folderPath) {
    searchParams.set('folderPath', params.folderPath)
  }
  if (params?.uiStatus) {
    searchParams.set('uiStatus', params.uiStatus)
  }

  const queryString = searchParams.toString()
  const response = await apiClient.get<OcrTrackedDossiersResultT>(
    `/api/v1/dossiers/ocr-control/tracked${queryString ? `?${queryString}` : ''}`,
  )
  return response.data
}
