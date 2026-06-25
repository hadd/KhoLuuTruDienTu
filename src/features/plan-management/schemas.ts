import { z } from 'zod'

import type { PlanPeriodT } from '@/features/plan-management/types'

export const PLAN_PERIODS = [
  'all',
  '7d',
  '30d',
  '90d',
  '12m',
] as const satisfies ReadonlyArray<PlanPeriodT>

export const planSearchSchema = z.object({
  projectCode: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().catch(50),
  offset: z.coerce.number().int().min(0).optional().catch(0),
  status: z.enum(['all']).optional().catch('all'),
  period: z
    .enum(PLAN_PERIODS)
    .optional()
    .catch('all' satisfies PlanPeriodT),
})

export type PlanSearchT = z.infer<typeof planSearchSchema>

export const createPlanSchema = z
  .object({
    name: z.string().trim().min(1),
    projectCode: z.string().trim().min(1),
    a4Pages: z.coerce.number().int().min(0),
    a3Pages: z.coerce.number().int().min(0),
    dossierCount: z.coerce.number().int().min(0),
    quota: z.string().trim().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ['endDate'],
  })

export type CreatePlanFormValues = z.infer<typeof createPlanSchema>

export const updatePlanSchema = createPlanSchema

export type UpdatePlanFormValues = CreatePlanFormValues
