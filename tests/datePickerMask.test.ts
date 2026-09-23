import { format, isValid, parse, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'

function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseValueToDate(val?: string): Date | undefined {
  if (!val || !val.trim()) return undefined
  const trimmed = val.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = parseISO(trimmed)
    if (isValid(parsed)) return parsed
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parsed = parse(trimmed, 'dd/MM/yyyy', new Date())
    if (isValid(parsed) && format(parsed, 'dd/MM/yyyy') === trimmed) {
      return parsed
    }
  }

  return undefined
}

describe('DatePickerMask logic', () => {
  it('masks raw digits correctly', () => {
    expect(applyDateMask('1')).toBe('1')
    expect(applyDateMask('10')).toBe('10')
    expect(applyDateMask('100')).toBe('10/0')
    expect(applyDateMask('1003')).toBe('10/03')
    expect(applyDateMask('10032')).toBe('10/03/2')
    expect(applyDateMask('10032024')).toBe('10/03/2024')
    expect(applyDateMask('10032024999')).toBe('10/03/2024')
  })

  it('parses ISO date and dd/MM/yyyy date correctly', () => {
    const date1 = parseValueToDate('2026-09-21')
    expect(date1).toBeDefined()
    expect(format(date1!, 'dd/MM/yyyy')).toBe('21/09/2026')

    const date2 = parseValueToDate('21/09/2026')
    expect(date2).toBeDefined()
    expect(format(date2!, 'yyyy-MM-dd')).toBe('2026-09-21')

    const dateInvalid = parseValueToDate('31/02/2026')
    expect(dateInvalid).toBeUndefined()
  })
})
