import { format, isValid, parse } from 'date-fns'

import type { DataDocumentFieldT } from '@/features/data-management/types'

const INPUT_FORMATS = [
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'd-M-yyyy',
  'yyyy-MM-dd',
] as const

/** Coerces API metadata values (number, boolean, object, etc.) to text. */
export function coerceMetadataText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' || typeof value === 'bigint')
    return String(value)
  return String(value)
}

/** Converts metadata date strings (e.g. 10/03/2023) to yyyy-MM-dd for &lt;input type="date" /&gt; */
export function metadataDateToInputValue(value: unknown): string {
  const trimmed = coerceMetadataText(value).trim()
  if (!trimmed) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  for (const pattern of INPUT_FORMATS) {
    const parsed = parse(trimmed, pattern, new Date())
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  }

  return ''
}

/** Converts date input value back to metadata display format when possible */
export function metadataDateFromInputValue(
  inputValue: string,
  originalValue: string | null,
): string | null {
  const trimmedInput = inputValue.trim()
  if (!trimmedInput) {
    return originalValue == null ? null : ''
  }

  const parsed = parse(trimmedInput, 'yyyy-MM-dd', new Date())
  if (!isValid(parsed)) {
    return trimmedInput
  }

  const original = coerceMetadataText(originalValue).trim()
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(original)) {
    return format(parsed, 'dd/MM/yyyy')
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(original)) {
    return format(parsed, 'dd-MM-yyyy')
  }

  return trimmedInput
}

/** Converts form text back to stored metadata value, preserving null when unchanged. */
export function resolveMetadataValueForSave(
  rawValue: unknown,
  originalValue: string | null,
  fieldType: DataDocumentFieldT['type'] = 'string',
): string | null {
  if (fieldType === 'boolean') {
    const text = coerceMetadataText(rawValue)
    if (originalValue == null && text !== 'true') {
      return null
    }
    return text === 'true' ? 'true' : 'false'
  }

  if (fieldType === 'date') {
    return metadataDateFromInputValue(
      coerceMetadataText(rawValue),
      originalValue,
    )
  }

  const text = coerceMetadataText(rawValue)
  if (text === '' && originalValue == null) {
    return null
  }
  return text
}

export function buildMetadataFieldValues(
  fields: Array<{ name: string; value: unknown; type: string }>,
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const field of fields) {
    if (field.type === 'date') {
      map[field.name] = metadataDateToInputValue(field.value)
      continue
    }
    if (field.type === 'boolean') {
      if (field.value == null) {
        map[field.name] = ''
        continue
      }
      const normalized = coerceMetadataText(field.value).trim().toLowerCase()
      map[field.name] =
        normalized === 'true' || normalized === '1' || normalized === 'yes'
          ? 'true'
          : 'false'
      continue
    }
    map[field.name] = coerceMetadataText(field.value)
  }
  return map
}
