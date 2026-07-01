import { z } from 'zod'

import i18n from '@/lib/i18n/config'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const newPasswordSchema = z
  .string()
  .min(1, {
    message: i18n.t('changePassword.errors.newPasswordRequired', {
      ns: 'auth',
    }),
  })
  .refine((value) => value.length > 8, {
    message: i18n.t('changePassword.errors.passwordMinLength', { ns: 'auth' }),
  })
  .refine((value) => !/\s/.test(value), {
    message: i18n.t('changePassword.errors.passwordNoSpace', { ns: 'auth' }),
  })

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, {
      message: i18n.t('changePassword.errors.currentPasswordRequired', {
        ns: 'auth',
      }),
    }),
    newPassword: newPasswordSchema,
    confirmNewPassword: z.string().min(1, {
      message: i18n.t('changePassword.errors.confirmPasswordRequired', {
        ns: 'auth',
      }),
    }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: i18n.t('changePassword.errors.passwordMismatch', { ns: 'auth' }),
    path: ['confirmNewPassword'],
  })

export type ChangePasswordFormValues = z.infer<typeof ChangePasswordSchema>

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
  .optional()
  .refine((value) => !value || /^0\d{9}$/.test(value), {
    message: i18n.t('errors.phoneInvalid', { ns: 'user' }),
  })

export const UserProfileSchema = z.object({
  fullName: z
    .string()
    .min(1, { message: i18n.t('errors.fullNameRequired', { ns: 'user' }) }),
  avatarUrl: z.string(),
  dateOfBirth: dateOfBirthSchema,
  gender: genderSchema.optional(),
  phone: phoneSchema,
  address: z.string().optional(),
})

export type UserProfileFormValues = z.infer<typeof UserProfileSchema>
