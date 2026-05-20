import type { ZodTypeAny } from 'zod'

import i18n from '@/lib/i18n/config'

/**
 * Get the first validation error message from a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param value - Value to validate
 * @returns Error message string or undefined if valid
 */
export function getFieldError(
  schema: ZodTypeAny,
  value: unknown,
): string | undefined {
  const result = schema.safeParse(value)
  if (!result.success) {
    return (
      result.error.issues[0]?.message ??
      i18n.t('errors.invalidValue', { ns: 'common' })
    )
  }
  return undefined
}
