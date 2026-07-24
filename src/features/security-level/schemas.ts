import { z } from 'zod'

import { listPageSearchSchema } from '@/lib/schemas/list-page-search'

export const securityLevelSearchSchema = listPageSearchSchema.extend({
  q: z.string().optional().catch(undefined),
})

export type SecurityLevelSearchT = z.infer<typeof securityLevelSearchSchema>

export const securityLevelFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  levelOrder: z.coerce.number().int().min(1),
  description: z.string().trim().optional().default(''),
})

export type SecurityLevelFormValues = z.infer<typeof securityLevelFormSchema>

export const securityPermissionDefFormSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]*$/, 'Invalid key')
    .max(64),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().optional().default(''),
})

export type SecurityPermissionDefFormValues = z.infer<
  typeof securityPermissionDefFormSchema
>

export const securityPermissionDefEditSchema = securityPermissionDefFormSchema.omit({
  key: true,
})

export type SecurityPermissionDefEditValues = z.infer<
  typeof securityPermissionDefEditSchema
>

export const securityAccessPasswordSchema = z.object({
  password: z.string().min(1),
})

export type SecurityAccessPasswordValues = z.infer<
  typeof securityAccessPasswordSchema
>
