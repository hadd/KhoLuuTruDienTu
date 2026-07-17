import { z } from 'zod'

import { calculatePlanDaysFromRange } from '@/features/plan-management/lib/planStats'
import {
  createEmptyPaperPlanRow,
  normalizePaperSizeName,
} from '@/features/plan-management/lib/planPaperPlanDefaults'
import { paperPlanRowSchema } from '@/features/plan-management/lib/planPaperPlanRowSchema'
import i18n from '@/lib/i18n/config'

export const planSearchSchema = z.object({
  projectCode: z.string().optional(),
  viewAll: z.coerce.boolean().optional().catch(true),
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
  limit: z.coerce.number().int().min(1).max(100).optional().catch(20),
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

function addPaperPlansDuplicateValidation<T extends z.ZodType>(
  schema: T,
): z.ZodEffects<T, z.infer<T>, z.input<T>> {
  return schema.superRefine((data, ctx) => {
    const formData = data as z.infer<typeof planFormBaseSchema> & {
      paperPlans: Array<{ paperSizeName: string }>
    }
    const seen = new Set<string>()

    formData.paperPlans.forEach((row, index) => {
      const key = normalizePaperSizeName(row.paperSizeName)
      if (!key) {
        return
      }

      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['paperPlans', index, 'paperSizeName'],
          message: i18n.t('form.fields.paperPlans.duplicatePaperSize', {
            ns: 'plan-management',
          }),
        })
        return
      }

      seen.add(key)
    })
  })
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

const planFormSchema = addPaperPlansDuplicateValidation(
  addDateCountRangeValidation(
    planFormBaseSchema
      .extend({
        paperPlans: z
          .array(paperPlanRowSchema)
          .min(
            1,
            i18n.t('form.fields.paperPlans.minOne', { ns: 'plan-management' }),
          ),
      })
      .refine(
        planDateRangeRefinement.refine,
        planDateRangeRefinement.refineOptions,
      ),
  ),
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
