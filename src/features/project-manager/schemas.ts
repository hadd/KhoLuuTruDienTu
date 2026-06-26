import { z } from 'zod'

export const PROJECT_STATUS_VALUES = [
  'IN_PROGRESS',
  'EXTENDED',
  'ACCEPTED',
  'SUSPENDED',
  'CANCELLED',
] as const

export const projectSearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().catch(50),
  offset: z.coerce.number().int().min(0).optional().catch(0),
})

export type ProjectSearchT = z.infer<typeof projectSearchSchema>

export const projectFormSchema = z.object({
  projectCode: z.string().trim().min(1),
  projectName: z.string().trim().min(1),
  projectType: z.string().trim().min(1),
  investor: z.string().trim().min(1),
  startDate: z.string().optional(),
  acceptanceDate: z.string().min(1),
  totalInvestment: z.string().optional(),
  status: z.enum(PROJECT_STATUS_VALUES),
  managerId: z.string().optional(),
})

export const createProjectSchema = projectFormSchema

export type ProjectFormValues = z.infer<typeof projectFormSchema>
export type CreateProjectFormValues = ProjectFormValues
