import type { UserT } from '@/features/auth/types'

export type { UserT }

export type AdminUserGenderT = 'male' | 'female' | ''

export type AdminUserCreatePayloadT = {
  email: string
  fullName: string
  password: string
  dateOfBirth?: string
  gender?: AdminUserGenderT
  phone?: string
  address?: string
  role: Array<string>
}

export type AdminUserUpdatePayloadT = Omit<AdminUserCreatePayloadT, 'password'> & {
  password?: string
}
