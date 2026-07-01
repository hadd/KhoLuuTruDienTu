import axios from 'axios'

import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'

import type {
  AuthLoginApiResponseT,
  LoginForm,
  LoginResponseT,
  UserT,
} from '../types'

const authHttp = axios.create({
  baseURL: env.API_URL,
  headers: { 'Content-Type': 'application/json' },
})

export const login = async (payload: LoginForm): Promise<LoginResponseT> => {
  const { data } = await authHttp.post<AuthLoginApiResponseT>(
    '/api/auth/login',
    payload,
  )
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    roles: data.roles ?? [],
  }
}

export const getProfile = async () => {
  const response = await apiClient.get<UserT>('/api/auth/me')
  return response.data
}

export const logout = async (): Promise<void> => {
  await apiClient.post('/api/auth/logout')
}

export type ResetPasswordPayloadT = {
  currentPassword: string
  newPassword: string
}

export const resetPassword = async (
  userId: string,
  payload: ResetPasswordPayloadT,
): Promise<void> => {
  await apiClient.put(`/api/v1/admin/users/${userId}/reset-password`, payload)
}
