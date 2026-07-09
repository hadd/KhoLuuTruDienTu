import { z } from 'zod'

export const DEFAULT_LIST_PAGE_LIMIT = 20

export const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

const listPageLimitSchema = z.coerce
  .number()
  .int()
  .refine((value) =>
    (LIST_PAGE_SIZE_OPTIONS as ReadonlyArray<number>).includes(value),
  )

export const listPageSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
  limit: listPageLimitSchema.optional().catch(DEFAULT_LIST_PAGE_LIMIT),
})
