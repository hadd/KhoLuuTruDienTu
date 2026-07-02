import { z } from 'zod'

export const documentTypeSearchSchema = z.object({
  templateId: z.string().optional(),
})

export type DocumentTypeSearchT = z.infer<typeof documentTypeSearchSchema>

export const documentAssignmentSearchSchema = z.object({
  templateId: z.string().optional(),
  configId: z.string().optional(),
})

export type DocumentAssignmentSearchT = z.infer<
  typeof documentAssignmentSearchSchema
>

export const metadataExportPresetSearchSchema = z.object({
  presetId: z.string().optional(),
  templateId: z.string().optional(),
})

export type MetadataExportPresetSearchT = z.infer<
  typeof metadataExportPresetSearchSchema
>

export const createPermissionConfigSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().default(''),
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

export const updateMetadataTemplateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string(),
})

export type UpdateMetadataTemplateFormT = z.infer<
  typeof updateMetadataTemplateSchema
>
