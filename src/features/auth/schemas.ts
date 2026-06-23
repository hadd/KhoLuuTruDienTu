import { z } from 'zod'

import i18n from '@/lib/i18n/config'

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const newPasswordSchema = z
  .string()
  .min(1, {
    message: i18n.t('changePassword.errors.newPasswordRequired', { ns: 'auth' }),
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
