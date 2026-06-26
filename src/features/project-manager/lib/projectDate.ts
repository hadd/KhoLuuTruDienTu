import { format, isValid, parse } from 'date-fns'

const INPUT_FORMATS = [
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'd-M-yyyy',
  'yyyy-MM-dd',
] as const

/** Chuyển giá trị ngày từ API sang định dạng yyyy-MM-dd cho input type="date". */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value?.trim()) return ''

  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  for (const pattern of INPUT_FORMATS) {
    const parsed = parse(trimmed, pattern, new Date())
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  }

  const parsed = new Date(trimmed)
  if (!isValid(parsed)) {
    return ''
  }

  return format(parsed, 'yyyy-MM-dd')
}
