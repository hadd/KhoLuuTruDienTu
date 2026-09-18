import { apiClient } from '@/lib/api/apiClient'

export type PageQuotaT = {
  usedPages: number
  pendingPages: number
  pageLimit: number | null
  remaining: number | null
  routingStopped: boolean
  customer: string | null
  licenseIssuedAt: string | null
  hasLicense: boolean
  enforced: boolean
  integrityOk: boolean
}

export type PageQuotaUploadCheckT = {
  allowed: boolean
  pages: number
  remaining: number | null
  usedPages: number
  pageLimit: number | null
  message: string | null
}

export async function getPageQuota(): Promise<PageQuotaT> {
  const response = await apiClient.get<PageQuotaT>('/api/v1/page-quota')
  return response.data
}

export async function checkPageQuotaUpload(
  pages: number,
): Promise<PageQuotaUploadCheckT> {
  const response = await apiClient.post<PageQuotaUploadCheckT>(
    '/api/v1/page-quota/check-upload',
    { pages },
    { _skipGlobalErrorToast: true },
  )
  return response.data
}

export async function uploadPageQuotaLicense(file: File): Promise<PageQuotaT> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.postForm<PageQuotaT>(
    '/api/v1/page-quota/license',
    formData,
  )
  return response.data
}
