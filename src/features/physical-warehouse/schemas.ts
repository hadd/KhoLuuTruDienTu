import { z } from 'zod'

import i18n from '@/lib/i18n/config'

export const itemFormSchema = z
  .object({
    name: z.string().trim().min(1),
    imageUrl: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    mapsUrl: z.string().trim().optional().nullable(),
    capacity: z.coerce.number().int().min(0).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.capacity != null && data.capacity < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['capacity'],
        message: i18n.t('form.fields.capacity.invalid', {
          ns: 'physical-warehouse',
        }),
      })
    }
  })

export type ItemFormValues = z.infer<typeof itemFormSchema>

export const physicalWarehouseSearchSchema = z.object({
  rootId: z.string().optional().catch(undefined),
  warehouseId: z.string().optional().catch(undefined),
  tab: z.enum(['diagram', 'manage']).optional().catch(undefined),
  parentId: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
})

export type PhysicalWarehouseSearchT = z.infer<
  typeof physicalWarehouseSearchSchema
>
