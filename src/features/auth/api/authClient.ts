import { apiClient } from '@/lib/api/apiClient'

import type { LoginForm, LoginResponseT, UserT, UserRoleT } from '../types'

// export const login = async (payload: LoginForm) => {
//   const response = await apiClient.post<LoginResponseT>(
//     '/api/auth/login',
//     payload,
//   )
//   return response.data
// }

export const login = async (payload: LoginForm): Promise<LoginResponseT> => {
  // --- Production: gọi API thật (bật lại khi cần) ---
  // const response = await apiClient.post<LoginResponseT>(
  //   '/api/auth/login',
  //   payload,
  // )
  // return response.data

  // --- Tạm: mock login (xóa khi nối API) ---
  await new Promise((r) => setTimeout(r, 200)) // giả latency, tùy chọn

  const suffix = crypto.randomUUID().slice(0, 8)

  const now = new Date().toISOString()
  const userId = `mock-user-${suffix}`
  const roleId = `mock-role-admin`

  const mockAdminUserRole = {
    id: `mock-user-role-${suffix}`,
    userId,
    roleId,
    isCurrent: true,
    createdAt: now,
    expiredAt: null,
    role: {
      id: roleId,
      name: 'admin', // lowercase — getAllowedMenuGroups() so sánh lowercase
      description: 'Mock administrator',
      rules: '{}',
      isBaseRole: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }

  return {
    accessToken: `mock-access-${suffix}`,
    refreshToken: `mock-refresh-${suffix}`,
    user: {
      id: `mock-user-${suffix}`,
      email: payload.email || `user-${suffix}@example.test`,
      fullName: `Mock User ${suffix}`,
      avatarUrl: null,
      dateOfBirth: null,
      gender: null,
      phone: null,
      address: null,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      userRoles: [mockAdminUserRole],
      studentInClassroom: [],
      teacherInClassroom: [],
      // academicYear / school: nếu app đọc sâu, bạn cần object tối thiểu hợp lệ
      // hoặc dùng `as LoginResponseT` / partial + cast (nhanh nhưng dễ lỗi runtime)
      academicYear: {} as UserT['academicYear'], // chỉ nên dùng nếu bạn chắc UI không đụng tới
    } as UserT,
  }
}

export const getProfile = async () => {
  const response = await apiClient.get<UserT>('/api/auth/me')
  return response.data
}