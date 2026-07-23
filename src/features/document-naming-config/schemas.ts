import { z } from 'zod'

import i18n from '@/lib/i18n/config'

import type {
  DocumentNamingSegmentSourceT,
  DocumentNamingSegmentT,
  DocumentNamingTargetTypeT,
} from '@/features/document-naming-config/types'

export const documentNamingSearchSchema = z.object({
  fondId: z.string().optional().catch(undefined),
  dossierId: z.string().uuid().optional().catch(undefined),
})

export type DocumentNamingSearchT = z.infer<typeof documentNamingSearchSchema>

export const namingSegmentSchema = z.object({
  length: z.number().int().min(1).max(64),
  source: z.enum([
    'fixed',
    'auto_increment',
    'year',
    'month',
    'day',
    'fond_field',
    'dossier_field',
    'file_field',
  ]),
  value: z.string().max(255).nullable().optional(),
  fieldKey: z.string().max(100).nullable().optional(),
  padChar: z.string().max(1).nullable().optional(),
})

export const DATE_SEGMENT_SOURCE_VALUES = ['year', 'month', 'day'] as const

export const SEGMENT_SOURCE_VALUES = [
  'fixed',
  'auto_increment',
  ...DATE_SEGMENT_SOURCE_VALUES,
  'fond_field',
  'dossier_field',
  'file_field',
] as const

export const DOSSIER_SEGMENT_SOURCE_VALUES = [
  'fixed',
  'auto_increment',
  ...DATE_SEGMENT_SOURCE_VALUES,
  'fond_field',
  'dossier_field',
] as const

export const FILE_SEGMENT_SOURCE_VALUES = SEGMENT_SOURCE_VALUES

export type NamingSegmentFieldT =
  | 'length'
  | 'source'
  | 'value'
  | 'fieldKey'
  | 'padChar'
  | 'segments'

export type NamingSegmentFieldErrorT = {
  index: number
  field: NamingSegmentFieldT
  message: string
}

const FIELD_SOURCE_VALUES: Record<
  DocumentNamingTargetTypeT,
  ReadonlyArray<DocumentNamingSegmentSourceT>
> = {
  dossier: DOSSIER_SEGMENT_SOURCE_VALUES,
  file: FILE_SEGMENT_SOURCE_VALUES,
}

function needsValue(source: DocumentNamingSegmentSourceT): boolean {
  return source === 'fixed' || source === 'auto_increment'
}

function needsFieldKey(source: DocumentNamingSegmentSourceT): boolean {
  return (
    source === 'fond_field' ||
    source === 'dossier_field' ||
    source === 'file_field'
  )
}

function tSegmentError(
  key:
    | 'segmentsRequired'
    | 'invalidSource'
    | 'invalidLength'
    | 'valueRequired'
    | 'fieldKeyRequired'
    | 'invalidPadChar',
  params?: Record<string, string | number>,
): string {
  return i18n.t(`segments.validation.${key}`, {
    ns: 'document-naming-config',
    ...params,
  })
}

export function createNamingSegmentsSchema(targetType: DocumentNamingTargetTypeT) {
  const allowedSources = FIELD_SOURCE_VALUES[targetType]

  return z
    .array(namingSegmentSchema)
    .min(1, tSegmentError('segmentsRequired'))
    .superRefine((segments, ctx) => {
      segments.forEach((segment, index) => {
        if (!allowedSources.includes(segment.source)) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'source'],
            message: tSegmentError('invalidSource', { position: index + 1 }),
          })
        }

        if (!Number.isInteger(segment.length) || segment.length < 1) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'length'],
            message: tSegmentError('invalidLength', { position: index + 1 }),
          })
        }

        if (needsValue(segment.source) && !segment.value?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'value'],
            message: tSegmentError('valueRequired', { position: index + 1 }),
          })
        }

        if (needsFieldKey(segment.source) && !segment.fieldKey?.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'fieldKey'],
            message: tSegmentError('fieldKeyRequired', { position: index + 1 }),
          })
        }

        if (segment.padChar != null && segment.padChar.length > 1) {
          ctx.addIssue({
            code: 'custom',
            path: [index, 'padChar'],
            message: tSegmentError('invalidPadChar', { position: index + 1 }),
          })
        }
      })
    })
}

export function validateDocumentNamingSegments(
  segments: Array<DocumentNamingSegmentT>,
  targetType: DocumentNamingTargetTypeT,
): NamingSegmentFieldErrorT[] {
  const result = createNamingSegmentsSchema(targetType).safeParse(segments)
  if (result.success) return []

  return result.error.issues.map((issue) => {
    const [index, field] = issue.path

    if (typeof index !== 'number') {
      return {
        index: -1,
        field: 'segments',
        message: issue.message,
      }
    }

    return {
      index,
      field: (typeof field === 'string'
        ? field
        : 'segments') as NamingSegmentFieldT,
      message: issue.message,
    }
  })
}

export function getSegmentFieldError(
  errors: Array<NamingSegmentFieldErrorT>,
  index: number,
  field: NamingSegmentFieldT,
): string | undefined {
  return errors.find((error) => error.index === index && error.field === field)
    ?.message
}

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
