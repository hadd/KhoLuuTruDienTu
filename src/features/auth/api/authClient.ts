import axios from 'axios'

import { apiClient } from '@/lib/api/apiClient'
import { env } from '@/lib/utils/env'

import type {
  AuthLoginApiResponseT,
  LoginForm,
  LoginResponseT,
  Resend2FAPayloadT,
  UserT,
  Verify2FAPayloadT,
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
  if (data.require2FA) {
    return {
      require2FA: true,
      challengeToken: data.challengeToken,
      maskedEmail: data.maskedEmail,
    }
  }
  return {
    require2FA: false,
    accessToken: data.accessToken ?? '',
    refreshToken: data.refreshToken ?? '',
    roles: data.roles ?? [],
  }
}

export const verify2FA = async (
  payload: Verify2FAPayloadT,
): Promise<LoginResponseT> => {
  const { data } = await authHttp.post<AuthLoginApiResponseT>(
    '/api/auth/verify-2fa',
    payload,
  )
  return {
    require2FA: false,
    accessToken: data.accessToken ?? '',
    refreshToken: data.refreshToken ?? '',
    roles: data.roles ?? [],
  }
}

export const resend2FA = async (
  payload: Resend2FAPayloadT,
): Promise<{ status: string; expiresIn: number }> => {
  const { data } = await authHttp.post<{ status: string; expiresIn: number }>(
    '/api/auth/resend-2fa',
    payload,
  )
  return data
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

export type UpdateDownloadPasswordPayloadT = {
  downloadPassword?: string | null
  downloadPasswordEnabled?: boolean
  currentDownloadPassword?: string | null
}

export type UpdateDownloadPasswordResultT = {
  hasDownloadPassword: boolean
  downloadPasswordEnabled: boolean
}

export const updateDownloadPassword = async (
  payload: UpdateDownloadPasswordPayloadT,
): Promise<UpdateDownloadPasswordResultT> => {
  const response = await apiClient.put<{
    record: UpdateDownloadPasswordResultT
    status: string
  }>('/api/v1/users/profile/download-password', payload)
  return response.data.record
}
