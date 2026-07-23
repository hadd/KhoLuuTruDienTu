import { z } from 'zod'

export const documentNamingSearchSchema = z.object({
  fondId: z.string().optional().catch(undefined),
  dossierId: z.string().uuid().optional().catch(undefined),
})

export type DocumentNamingSearchT = z.infer<typeof documentNamingSearchSchema>

export const namingSegmentSchema = z.object({
  length: z.number().int().min(0).max(64),
  source: z.enum([
    'fixed',
    'auto_increment',
    'year',
    'fond_field',
    'dossier_field',
    'file_field',
  ]),
  value: z.string().max(255).nullable().optional(),
  fieldKey: z.string().max(100).nullable().optional(),
  padChar: z.string().max(1).nullable().optional(),
})

export const SEGMENT_SOURCE_VALUES = [
  'fixed',
  'auto_increment',
  'year',
  'fond_field',
  'dossier_field',
  'file_field',
] as const

export function createEmptySegment(): z.infer<typeof namingSegmentSchema> {
  return {
    length: 1,
    source: 'fixed',
    value: '',
    fieldKey: null,
    padChar: null,
  }
}

export function moveSegment<T>(
  segments: Array<T>,
  fromIndex: number,
  toIndex: number,
): Array<T> {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= segments.length ||
    toIndex >= segments.length
  ) {
    return segments
  }
  const next = [...segments]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}
