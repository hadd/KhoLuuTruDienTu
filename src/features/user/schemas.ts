import { z } from 'zod'

import i18n from '@/lib/i18n/config'

const genderSchema = z.union([
  z.literal('male'),
  z.literal('female'),
  z.literal(''),
])

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const parseIsoDateOnly = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) return null

  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day

  return isValid ? date : null
}

const isValidIsoDate = (value: string) => parseIsoDateOnly(value) !== null

const isPastIsoDate = (value: string) => {
  const todayIso = new Date().toISOString().slice(0, 10)
  return value < todayIso
}

const dateOfBirthSchema = z
  .string()
  .optional()
  .refine((value) => !value || isValidIsoDate(value), {
    message: i18n.t('errors.dateOfBirthInvalid', { ns: 'user' }),
  })
  .refine((value) => !value || isPastIsoDate(value), {
    message: i18n.t('errors.dateOfBirthPast', { ns: 'user' }),
  })

const phoneSchema = z
  .string()
  .trim()
  .min(1, {
    message: i18n.t('errors.phoneInvalid', { ns: 'user' }),
  })
  .regex(/^0\d{9}$/, {
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
  securityLevelId: z.string().uuid({
    message: i18n.t('errors.securityLevelRequired', { ns: 'user' }),
  }),
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
