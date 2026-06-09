import type { UserT } from '@/features/auth/types'

export type { UserT }

export type AdminRoleRulesT = {
  permissions: Array<string>
  restrictions: Array<string>
}

export type AdminRoleUserRoleT = {
  id: string
  userId: string
  roleId: string
  createdAt: string
  expiredAt: string | null
}

export type AdminRoleT = {
  id: string
  name: string
  description: string | null
  rules: AdminRoleRulesT
  isBaseRole: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  userRoles: Array<AdminRoleUserRoleT>
}

export type AdminUserGenderT = 'male' | 'female' | ''

export type AdminUserCreatePayloadT = {
  email: string
  fullName: string
  password: string
  dateOfBirth?: string
  gender?: AdminUserGenderT
  phone?: string
  address?: string
  roleId: string
}

export type AdminUserUpdatePayloadT = Omit<AdminUserCreatePayloadT, 'password' | 'email'> & {
  password?: string
}

export type ImportUsersExcelResultT = {
  successCount: number
  failedCount: number
  errors: Array<string>
  errorFileDownloaded: boolean
}
