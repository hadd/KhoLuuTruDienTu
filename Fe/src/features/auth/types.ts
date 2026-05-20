import type { z } from 'zod'

// Minimal type definitions for UserT dependencies
// These can be expanded later when full type definitions are created
import type { AcademicYearT, SchoolT } from '@/types/common'

import type { LoginSchema } from './schemas'

export type LoginForm = z.infer<typeof LoginSchema>

export type RoleT = {
  id: string
  name: string
  description: string | null
  rules: string
  isBaseRole: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type UserRoleT = {
  id: string
  userId: string
  roleId: string
  isCurrent?: boolean
  createdAt: string
  expiredAt: string | null
  role: RoleT
}

export type { SchoolT, AcademicYearT }

export type StudentT = {
  id: string
  userId: string
  schoolId: string
  studentCode: string
  phone: string | null
  dateOfBirth: string | null
  gender: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  enrollmentDate: string
  exitDate: string | null
  exitReason: string | null
  currentGradeLevel: string | null
  currentStatus: string
  isCurrent: boolean
  fullName: string | null
  parentContact: string | null
}

export type TeacherT = {
  id: string
  userId: string
  schoolId: string
  employeeCode: string
  name: string
  phone: string
  description: string
  subjectsKeys: Array<string>
  status: string
  startedAt: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  startDate: string
}

export type UserT = {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  dateOfBirth: string | null
  gender: string | null
  phone: string | null
  address: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  userRoles?: Array<UserRoleT>
  school?: SchoolT
  studentInClassroom?: Array<StudentT>
  teacherInClassroom?: Array<TeacherT>
  academicYear?: AcademicYearT
  userId?: string
}

export type TokensT = {
  accessToken: string
  refreshToken: string
}

export type LoginResponseT = TokensT & {
  user?: UserT
}

export type AuthLoginApiResponseT = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}