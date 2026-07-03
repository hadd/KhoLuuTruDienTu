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

export const getProfile = async (): Promise<UserT> => {
  const response = await apiClient.get<{ record: UserT }>(
    '/api/v1/users/profile',
  )
  return response.data.record
}

export type UpdateProfilePayloadT = {
  fullName: string
  avatarUrl: string
  dateOfBirth?: string
  gender?: 'male' | 'female'
  phone?: string
  address?: string
}

export const updateProfile = async (
  payload: UpdateProfilePayloadT,
): Promise<UserT> => {
  const response = await apiClient.put<{ record: UserT }>(
    '/api/v1/users/profile',
    payload,
  )
  return response.data.record
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
