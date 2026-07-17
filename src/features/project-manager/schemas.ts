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
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
  limit: z.coerce.number().int().min(1).max(100).optional().catch(20),
})

export type ProjectSearchT = z.infer<typeof projectSearchSchema>

function normalizeDateOnly(value: string): string {
  return value.trim().slice(0, 10)
}

function toDateOnlyTimestamp(value: string): number | null {
  const normalizedValue = normalizeDateOnly(value)

  if (!normalizedValue) return null

  const isoMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return Date.UTC(Number(year), Number(month) - 1, Number(day))
  }

  const slashMatch = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    return Date.UTC(Number(year), Number(month) - 1, Number(day))
  }

  const parsedDate = new Date(normalizedValue)
  if (Number.isNaN(parsedDate.getTime())) return null

  return Date.UTC(
    parsedDate.getUTCFullYear(),
    parsedDate.getUTCMonth(),
    parsedDate.getUTCDate(),
  )
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
  const startDateTimestamp = toDateOnlyTimestamp(value.startDate)
  const acceptanceDateTimestamp = toDateOnlyTimestamp(value.acceptanceDate)

  if (
    startDateTimestamp !== null &&
    acceptanceDateTimestamp !== null &&
    startDateTimestamp >= acceptanceDateTimestamp
  ) {
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
