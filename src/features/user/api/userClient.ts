import type { UserT } from '@/features/auth/types'
import type {
  AdminUserCreatePayloadT,
  AdminUserUpdatePayloadT,
  ImportUsersExcelResultT,
} from '@/features/user/types'
import { apiClient } from '@/lib/api/apiClient'
import type { ListQueryParams } from '@/lib/api/query-params'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export type GetAllUsersParamsT = Pick<ListQueryParams, 'page' | 'limit'>

export const getAllUsers = async (
  params?: GetAllUsersParamsT,
): Promise<PaginatedResponse<UserT>> => {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/admin/users/all${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<UserT>>(url)
  return response.data
}

export type UsersByRoleResponseT = {
  items: Array<UserT>
  total: number
}

export const getUsersByRole = async (
  roleId: string,
): Promise<UsersByRoleResponseT> => {
  const response = await apiClient.get<UsersByRoleResponseT>(
    `/api/v1/admin/users/by-role/${roleId}`,
  )
  return response.data
}

export type UsersByPermissionResponseT = {
  items: Array<UserT>
  total: number
}

export const getUsersByPermission = async (
  permission: string,
): Promise<UsersByPermissionResponseT> => {
  const searchParams = new URLSearchParams()
  searchParams.set('permission', permission)

  const response = await apiClient.get<UsersByPermissionResponseT>(
    `/api/v1/admin/users/by-permission?${searchParams.toString()}`,
  )
  return response.data
}

export const createUser = async (
  data: AdminUserCreatePayloadT,
): Promise<UserT> => {
  const response = await apiClient.post<SingleResourceResponse<UserT>>(
    '/api/v1/admin/users',
    data,
  )
  return response.data.record
}

export const updateUser = async (
  id: string,
  data: AdminUserUpdatePayloadT,
): Promise<UserT> => {
  const response = await apiClient.put<SingleResourceResponse<UserT>>(
    `/api/v1/admin/users/${id}`,
    data,
  )
  return response.data.record
}

export const deleteUser = async (id: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/users/${id}`)
}

export type DeleteUsersResultT = {
  succeeded: Array<string>
  failed: Array<string>
}

export const deleteUsers = async (
  ids: Array<string>,
): Promise<DeleteUsersResultT> => {
  const results = await Promise.allSettled(ids.map((id) => deleteUser(id)))

  const succeeded: Array<string> = []
  const failed: Array<string> = []

  results.forEach((result, index) => {
    const id = ids[index]
    if (!id) return

    if (result.status === 'fulfilled') {
      succeeded.push(id)
      return
    }

    failed.push(id)
  })

  return { succeeded, failed }
}

export const updateUserStatus = async (
  id: string,
  active: boolean,
): Promise<UserT> => {
  const response = await apiClient.patch<SingleResourceResponse<UserT>>(
    `/api/v1/admin/users/${id}/status`,
    { active },
  )
  return response.data.record
}

export const exportUsersExcel = async (): Promise<void> => {
  try {
    const response = await apiClient.get<Blob>('/api/v1/admin/users/export', {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))

    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'users.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Lỗi khi xuất file Excel:', error)
    throw error
  }
}

type ImportUsersExcelApiResponseT = {
  success?: number
  failed?: number
  successCount?: number
  failedCount?: number
  errors?: Array<string>
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function isZipBasedExcelBuffer(data: ArrayBuffer): boolean {
  const bytes = new Uint8Array(data)
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

function isExcelResponseContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  return (
    normalized.includes('spreadsheetml') ||
    normalized.includes('ms-excel') ||
    normalized.includes('octet-stream')
  )
}

function downloadArrayBufferAsFile(
  data: ArrayBuffer,
  fileName: string,
  mimeType = XLSX_MIME,
): void {
  const url = window.URL.createObjectURL(new Blob([data], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function parseImportUsersExcelJson(
  data: ArrayBuffer,
): ImportUsersExcelApiResponseT {
  const text = new TextDecoder().decode(data).trim()
  if (!text.startsWith('{')) {
    throw new Error('Invalid import response format')
  }

  return JSON.parse(text) as ImportUsersExcelApiResponseT
}

export const importUsersExcel = async (
  file: File,
): Promise<ImportUsersExcelResultT> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.postForm<ArrayBuffer>(
    '/api/v1/admin/users/import',
    formData,
    {
      responseType: 'arraybuffer',
      _skipGlobalErrorToast: true,
    },
  )

  const contentType = String(response.headers['content-type'] ?? '')
  const responseData = response.data

  if (
    isExcelResponseContentType(contentType) &&
    isZipBasedExcelBuffer(responseData)
  ) {
    downloadArrayBufferAsFile(
      responseData,
      'import-errors.xlsx',
      contentType || XLSX_MIME,
    )
    return {
      successCount: 0,
      failedCount: 0,
      errors: [],
      errorFileDownloaded: true,
    }
  }

  const payload = parseImportUsersExcelJson(responseData)
  const successCount = payload.successCount ?? payload.success ?? 0
  const failedCount = payload.failedCount ?? payload.failed ?? 0
  const errors = payload.errors ?? []

  return {
    successCount,
    failedCount,
    errors,
    errorFileDownloaded: false,
  }
}

export const downloadUserTemplate = async (): Promise<void> => {
  const response = await apiClient.get<Blob>('/api/v1/admin/users/template', {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'user_template.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
