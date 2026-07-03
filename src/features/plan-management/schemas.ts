import { z } from 'zod'

import { calculatePlanDaysFromRange } from '@/features/plan-management/lib/planStats'
import { createEmptyPaperPlanRow } from '@/features/plan-management/lib/planPaperPlanDefaults'
import { paperPlanRowSchema } from '@/features/plan-management/lib/planPaperPlanRowSchema'
import i18n from '@/lib/i18n/config'

export const planSearchSchema = z.object({
  projectCode: z.string().optional(),
  viewAll: z.coerce.boolean().optional().catch(false),
  limit: z.coerce.number().int().min(1).max(100).optional().catch(50),
  offset: z.coerce.number().int().min(0).optional().catch(0),
})

export type PlanSearchT = z.infer<typeof planSearchSchema>

const planFormBaseSchema = z.object({
  name: z.string().trim().min(1),
  projectCode: z.string().trim().min(1),
  dossierCount: z.coerce.number().int().min(0),
  dateCount: z.coerce.number().int().min(0),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const planDateRangeRefinement = {
  refine: (data: z.infer<typeof planFormBaseSchema>) =>
    data.endDate >= data.startDate,
  refineOptions: { path: ['endDate'] as const },
}

function addDateCountRangeValidation<T extends z.ZodType>(
  schema: T,
): z.ZodEffects<T, z.infer<T>, z.input<T>> {
  return schema.superRefine((data, ctx) => {
    const formData = data as z.infer<typeof planFormBaseSchema>
    const maxDays = calculatePlanDaysFromRange(
      formData.startDate,
      formData.endDate,
    )

    if (formData.dateCount > maxDays) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateCount'],
        message: i18n.t('form.fields.dateCount.exceedsRange', {
          ns: 'plan-management',
          max: maxDays,
        }),
      })
    }
  })
}

export type { PaperPlanRowFormValues } from '@/features/plan-management/lib/planPaperPlanRowSchema'

const planFormSchema = addDateCountRangeValidation(
  planFormBaseSchema
    .extend({
      paperPlans: z
        .array(paperPlanRowSchema)
        .min(
          1,
          i18n.t('form.fields.paperPlans.minOne', { ns: 'plan-management' }),
        ),
    })
    .refine(planDateRangeRefinement.refine, planDateRangeRefinement.refineOptions),
)

export const createPlanSchema = planFormSchema
export type CreatePlanFormValues = z.infer<typeof createPlanSchema>

export const updatePlanSchema = planFormSchema
export type UpdatePlanFormValues = z.infer<typeof updatePlanSchema>
export type PlanFormValues = CreatePlanFormValues

export function createEmptyPlanFormValues(
  projectCode = '',
): PlanFormValues {
  return {
    name: '',
    projectCode,
    dossierCount: 0,
    dateCount: 0,
    startDate: '',
    endDate: '',
    paperPlans: [createEmptyPaperPlanRow()],
  }
}
