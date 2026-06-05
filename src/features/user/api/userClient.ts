import type { UserT } from '@/features/auth/types'
import type {
  AdminUserCreatePayloadT,
  AdminUserUpdatePayloadT,
} from '@/features/user/types'
import { apiClient } from '@/lib/api/apiClient'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export const getAllUsers = async (): Promise<PaginatedResponse<UserT>> => {
  const response = await apiClient.get<PaginatedResponse<UserT>>(
    '/api/v1/admin/users/all',
  )
  return response.data
}

export type UsersByRoleResponseT = {
  items: Array<UserT>
  total: number
}

export const getUsersByRole = async (roleId: string): Promise<UsersByRoleResponseT> => {
  const response = await apiClient.get<UsersByRoleResponseT>(
    `/api/v1/admin/users/by-role/${roleId}`,
  )
  return response.data
}

export const createUser = async (data: AdminUserCreatePayloadT): Promise<UserT> => {
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

export const updateUserStatus = async (id: string, active: boolean): Promise<UserT> => {
  const response = await apiClient.patch<SingleResourceResponse<UserT>>(
    `/api/v1/admin/users/${id}/status`,
    { active }
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

export const importUsersExcel = async (file: File): Promise<void> => {
  const formData = new FormData()
  formData.append('file', file)
  await apiClient.postForm('/api/v1/admin/users/import', formData)
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

