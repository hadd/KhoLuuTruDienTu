import { z } from 'zod'

const genderSchema = z.union([
  z.literal('male'),
  z.literal('female'),
  z.literal(''),
])

const roleSchema = z.array(z.string())

const baseFields = {
  fullName: z.string().min(1),
  email: z.string().email(),
  dateOfBirth: z.string().optional(),
  gender: genderSchema.optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  role: roleSchema.default([]),
}

export const AdminUserCreateSchema = z.object({
  ...baseFields,
  password: z.string().min(8),
})

export const AdminUserUpdateSchema = z.object({
  ...baseFields,
  password: z.string().optional(),
}).refine(
  (data) => !data.password || data.password.length >= 8,
  { path: ['password'], message: 'Password must be at least 8 characters' },
)

export type AdminUserCreateFormValues = z.infer<typeof AdminUserCreateSchema>
export type AdminUserUpdateFormValues = z.infer<typeof AdminUserUpdateSchema>

export type AdminUserFormValues = AdminUserCreateFormValues
