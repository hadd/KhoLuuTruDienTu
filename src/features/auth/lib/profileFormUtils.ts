import type { UpdateProfilePayloadT } from '@/features/auth/api/authClient'
import type { UserT } from '@/features/auth/types'
import type { UserProfileFormValues } from '@/features/auth/schemas'

export const emptyProfileFormValues: UserProfileFormValues = {
  fullName: '',
  avatarUrl: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  address: '',
}

export function userToProfileFormValues(user: UserT): UserProfileFormValues {
  return {
    fullName: user.fullName,
    avatarUrl: user.avatarUrl ?? '',
    dateOfBirth: user.dateOfBirth ?? '',
    gender:
      user.gender === 'male' || user.gender === 'female' ? user.gender : '',
    phone: user.phone ?? '',
    address: user.address ?? '',
  }
}

export function formValuesToUpdateProfilePayload(
  values: UserProfileFormValues,
): UpdateProfilePayloadT {
  const phone = values.phone.trim()
  const address = values.address?.trim() ?? ''

  return {
    fullName: values.fullName.trim(),
    avatarUrl: values.avatarUrl.trim(),
    dateOfBirth: values.dateOfBirth || undefined,
    gender:
      values.gender === 'male' || values.gender === 'female'
        ? values.gender
        : undefined,
    phone,
    address,
  }
}
