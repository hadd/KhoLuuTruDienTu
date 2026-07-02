import { z } from 'zod'

import i18n from '@/lib/i18n/config'

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

function normalizeDateOnly(value: string): string {
  return value.trim().slice(0, 10)
}

function getTodayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

export const projectFormSchema = z.object({
  projectCode: z.string().trim().min(1),
  projectName: z.string().trim().min(1),
  projectType: z.string().trim().min(1),
  investor: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  acceptanceDate: z.string().min(1),
  changeReason: z.string().optional(),
  totalInvestment: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value.trim()), {
      message: i18n.t('form.error.totalInvestmentMustBeNumber', {
        ns: 'project-manager',
      }),
    }),
  status: z.enum(PROJECT_STATUS_VALUES),
  managerId: z.string().optional(),
}).superRefine((value, ctx) => {
  const startDate = normalizeDateOnly(value.startDate)
  const acceptanceDate = normalizeDateOnly(value.acceptanceDate)
  const todayDate = getTodayDateOnly()

  if (startDate < todayDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startDate'],
      message: i18n.t('form.error.startDateMustBeTodayOrLater' as any, {
        ns: 'project-manager',
      }),
    })
  }

  if (startDate >= acceptanceDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['acceptanceDate'],
      message: i18n.t('form.error.acceptanceDateMustBeAfterStartDate' as any, {
        ns: 'project-manager',
      }),
    })
  }
})

export const createProjectSchema = projectFormSchema

export type ProjectFormValues = z.infer<typeof projectFormSchema>
export type CreateProjectFormValues = ProjectFormValues

export const closeIssueReportSchema = z.object({
  notes: z.string().trim().min(1),
})

export type CloseIssueReportFormValues = z.infer<typeof closeIssueReportSchema>
