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
    gender:
      user.gender === 'male' || user.gender === 'female' ? user.gender : '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    role: user.userRoles?.[0]?.roleId ?? '',
  }
}

export function formValuesToCreatePayload(
  values: AdminUserFormValues,
): AdminUserCreatePayloadT {
  const phone = values.phone?.trim()
  const address = values.address?.trim()

  return {
    email: values.email.trim(),
    fullName: values.fullName.trim(),
    password: values.password.trim(),
    dateOfBirth: values.dateOfBirth || undefined,
    gender: values.gender || undefined,
    phone: phone || undefined,
    address: address || undefined,
    roleId: values.role,
  }
}

export function formValuesToUpdatePayload(
  values: AdminUserFormValues,
): AdminUserUpdatePayloadT {
  const phone = values.phone?.trim()
  const address = values.address?.trim()
  const password = values.password.trim()

  const payload: AdminUserUpdatePayloadT = {
    fullName: values.fullName.trim(),
    dateOfBirth: values.dateOfBirth || undefined,
    gender: values.gender || undefined,
    phone: phone || undefined,
    address: address || undefined,
    roleId: values.role,
  }
  if (password) {
    payload.password = password
  }
  return payload
}
