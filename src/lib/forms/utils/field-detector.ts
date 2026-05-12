import type { ZodTypeAny } from 'zod'

import type { FieldType } from '../types'
import { hasEmailValidation } from './schema-utils'

/**
 * Detect field type from Zod schema only.
 * Does not use field name patterns - relies solely on schema type.
 * Developers can override the detected type using the `type` prop on FormField.
 */
export function detectFieldType(
  fieldSchema: ZodTypeAny | undefined,
  _fieldName: string, // Keep parameter for potential future use, but don't use it
): FieldType {
  if (!fieldSchema) {
    return 'text'
  }

  // Unwrap optional/nullable/default to get inner type
  // Accessing internal Zod API - need to use any

  let innerType: any = fieldSchema

  // Unwrap optional/default first
  while (
    innerType?._def?.typeName === 'ZodOptional' ||
    innerType?._def?.typeName === 'ZodDefault'
  ) {
    innerType = innerType._def.innerType || innerType._def.type
    if (!innerType) break
  }

  // Unwrap nullable if present
  if (innerType?._def?.typeName === 'ZodNullable') {
    innerType = innerType._def.innerType
  }

  // Get the final type name
  const typeName = innerType?._def?.typeName

  // Detect from Zod type only
  switch (typeName) {
    case 'ZodBoolean':
      return 'switch'

    case 'ZodNumber':
      return 'number'

    case 'ZodString': {
      // Check for email validation
      if (hasEmailValidation(fieldSchema)) {
        return 'email'
      }
      return 'text'
    }

    case 'ZodEnum':
      return 'select'

    case 'ZodArray':
      // Arrays default to text, can be overridden with type prop
      return 'text'

    default:
      // Fallback to text for unknown types
      return 'text'
  }
}
