import type { UserT } from '@/features/auth/types'
import type { AdminUserFormValues } from '@/features/user/schemas'
import type {
  AdminUserCreatePayloadT,
  AdminUserUpdatePayloadT,
} from '@/features/user/types'

export const emptyUserFormValues: AdminUserFormValues = {
  fullName: '',
  email: '',
  password: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  address: '',
  role: '',
}

export function userToFormValues(user: UserT): AdminUserFormValues {
  return {
    fullName: user.fullName,
    email: user.email,
    password: '',
    dateOfBirth: user.dateOfBirth ?? '',
    gender: user.gender === 'male' || user.gender === 'female' ? user.gender : '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    role: user.userRoles?.[0]?.roleId ?? '',
  }
}

export function formValuesToCreatePayload(
  values: AdminUserFormValues,
): AdminUserCreatePayloadT {
  return {
    email: values.email,
    fullName: values.fullName,
    password: values.password,
    dateOfBirth: values.dateOfBirth || undefined,
    gender: values.gender || undefined,
    phone: values.phone || undefined,
    address: values.address || undefined,
    role: values.role ? [values.role] : [],
  }
}

export function formValuesToUpdatePayload(
  values: AdminUserFormValues,
): AdminUserUpdatePayloadT {
  const payload: AdminUserUpdatePayloadT = {
    email: values.email,
    fullName: values.fullName,
    dateOfBirth: values.dateOfBirth || undefined,
    gender: values.gender || undefined,
    phone: values.phone || undefined,
    address: values.address || undefined,
    role: values.role ? [values.role] : [],
  }
  if (values.password?.trim()) {
    payload.password = values.password
  }
  return payload
}
