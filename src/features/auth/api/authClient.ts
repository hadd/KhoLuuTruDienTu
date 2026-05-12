import { apiClient } from '@/lib/api/apiClient'

import type { LoginForm, LoginResponseT, UserT } from '../types'

export const login = async (payload: LoginForm) => {
  const response = await apiClient.post<LoginResponseT>(
    '/api/auth/login',
    payload,
  )
  return response.data
}

export const getProfile = async () => {
  const response = await apiClient.get<UserT>('/api/auth/me')
  return response.data
}
