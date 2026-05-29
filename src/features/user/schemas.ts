import { z } from 'zod'

import i18n from '@/lib/i18n/config'

const genderSchema = z.union([
  z.literal('male'),
  z.literal('female'),
  z.literal(''),
])

const isPastDate = (value: string) => {
  if (!value) return true

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day

  if (!isValidDate) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return date < today
}

const dateOfBirthSchema = z
  .string()
  .optional()
  .refine((value) => !value || isPastDate(value), {
    message: i18n.t('errors.dateOfBirthPast', { ns: 'user' }),
  })

const phoneSchema = z
  .string()
  .optional()
  .refine((value) => !value || /^0\d{9}$/.test(value), {
    message: i18n.t('errors.phoneInvalid', { ns: 'user' }),
  })

const roleSchema = z
  .string()
  .min(1, { message: i18n.t('errors.roleRequired', { ns: 'user' }) })

const baseFields = {
  fullName: z
    .string()
    .min(1, { message: i18n.t('errors.fullNameRequired', { ns: 'user' }) }),
  email: z
    .string()
    .email({ message: i18n.t('errors.emailInvalid', { ns: 'user' }) }),
  dateOfBirth: dateOfBirthSchema,
  gender: genderSchema.optional(),
  phone: phoneSchema,
  address: z.string().optional(),
  role: roleSchema,
}

export const AdminUserCreateSchema = z.object({
  ...baseFields,
  password: z
    .string()
    .min(8, { message: i18n.t('errors.passwordMinLength', { ns: 'user' }) }),
})

export const AdminUserUpdateSchema = z.object({
  ...baseFields,
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 8, {
      message: i18n.t('errors.passwordMinLength', { ns: 'user' }),
    }),
})

export type AdminUserCreateFormValues = z.infer<typeof AdminUserCreateSchema>
export type AdminUserUpdateFormValues = z.infer<typeof AdminUserUpdateSchema>

export type AdminUserFormValues = AdminUserCreateFormValues
