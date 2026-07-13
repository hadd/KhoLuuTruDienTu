import { z } from 'zod'

export const WATERMARK_POSITION_VALUES = [
  'center',
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
  'tile_grid',
  'custom',
] as const

export const watermarkPositionSchema = z.enum(WATERMARK_POSITION_VALUES)

export const watermarkStampSchema = z.object({
  offsetXPercent: z.number().int().min(0).max(100),
  offsetYPercent: z.number().int().min(0).max(100),
  rotationDegrees: z.number().int().min(-180).max(180).optional(),
})

export const watermarkConfigSearchSchema = z.object({
  q: z.string().optional().catch(''),
  placementId: z.string().optional().catch(undefined),
})

function hasCustomPlacement(
  position: z.infer<typeof watermarkPositionSchema>,
  offsetX: number | null | undefined,
  offsetY: number | null | undefined,
  stamps: Array<z.infer<typeof watermarkStampSchema>> | null | undefined,
): boolean {
  if (position !== 'custom') return true
  const hasOffsets =
    offsetX !== null &&
    offsetX !== undefined &&
    offsetY !== null &&
    offsetY !== undefined
  const hasStamps = Array.isArray(stamps) && stamps.length > 0
  return hasOffsets || hasStamps
}

export const watermarkPlacementFormFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  imageEnabled: z.boolean(),
  imageAssetId: z.string().uuid().nullable(),
  imageOpacity: z.number().int().min(5).max(50),
  imagePosition: watermarkPositionSchema,
  imageSizePercent: z.number().int().min(5).max(100),
  imageOffsetXPercent: z.number().int().min(0).max(100).nullable(),
  imageOffsetYPercent: z.number().int().min(0).max(100).nullable(),
  imageRotationDegrees: z.number().int().min(-180).max(180),
  imageStamps: z.array(watermarkStampSchema).max(20).nullable(),
  textEnabled: z.boolean(),
  textContent: z.string().max(500).nullable(),
  textOpacity: z.number().int().min(5).max(50),
  textPosition: watermarkPositionSchema,
  textSizePercent: z.number().int().min(5).max(100),
  textOffsetXPercent: z.number().int().min(0).max(100).nullable(),
  textOffsetYPercent: z.number().int().min(0).max(100).nullable(),
  textRotationDegrees: z.number().int().min(-180).max(180),
  textStamps: z.array(watermarkStampSchema).max(20).nullable(),
})

export const watermarkPlacementFormSchema =
  watermarkPlacementFormFieldsSchema.superRefine((value, ctx) => {
    if (value.imageEnabled && !value.imageAssetId) {
      ctx.addIssue({
        code: 'custom',
        path: ['imageAssetId'],
        message: 'imageAssetRequired',
      })
    }

    if (
      value.textEnabled &&
      (!value.textContent || value.textContent.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['textContent'],
        message: 'textContentRequired',
      })
    }

    if (
      !hasCustomPlacement(
        value.imagePosition,
        value.imageOffsetXPercent,
        value.imageOffsetYPercent,
        value.imageStamps,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['imageOffsetXPercent'],
        message: 'customOffsetRequired',
      })
    }

    if (
      !hasCustomPlacement(
        value.textPosition,
        value.textOffsetXPercent,
        value.textOffsetYPercent,
        value.textStamps,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['textOffsetXPercent'],
        message: 'customOffsetRequired',
      })
    }
  })

export type WatermarkConfigSearchT = z.infer<typeof watermarkConfigSearchSchema>
export type WatermarkPlacementFormT = z.infer<
  typeof watermarkPlacementFormSchema
>
export type WatermarkStampFormT = z.infer<typeof watermarkStampSchema>
