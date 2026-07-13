import { z } from 'zod'

export const archivePermissionSearchSchema = z.object({
  configId: z.string().uuid().optional(),
  groupId: z.string().min(1).optional(),
  tab: z.enum(['configs', 'groups', 'direct']).optional(),
})

export const createArchivePermissionConfigSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
})
