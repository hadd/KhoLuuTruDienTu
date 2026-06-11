import { z } from 'zod'

export const documentTypeSearchSchema = z.object({
  templateId: z.string().optional(),
})

export type DocumentTypeSearchT = z.infer<typeof documentTypeSearchSchema>

export const documentAssignmentSearchSchema = z.object({
  templateId: z.string().optional(),
  configId: z.string().optional(),
  slotCode: z.string().optional(),
})

export type DocumentAssignmentSearchT = z.infer<
  typeof documentAssignmentSearchSchema
>

export const createPermissionConfigSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
})

export type CreatePermissionConfigFormT = z.infer<
  typeof createPermissionConfigSchema
>

export const createMetadataTemplateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
  dossierId: z.string().uuid(),
})

export type CreateMetadataTemplateFormT = z.infer<
  typeof createMetadataTemplateSchema
>
