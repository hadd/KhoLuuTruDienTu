import type { ZodObject, ZodTypeAny } from 'zod'

import { getFieldError } from '@/lib/utils/form-validation'

import type { FieldType, ValidateOn } from './types'

// Type guard for accessing Zod internal properties
// In Zod v4, type is stored in _def.type (string) not typeName
type ZodDefWithType = {
  type: string // The type name like "optional", "boolean", "string", "array", etc.
  innerType?: ZodTypeAny
  element?: ZodTypeAny // For ZodArray (element type)
  checks?: Array<{ kind: string }>
  values?: Array<string>
}

/**
 * Recursively unwrap all wrapper types (Optional, Nullable, Default, Effects, Pipeline, Branded)
 * This handles wrappers in any order and any depth
 */
export function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  let current: ZodTypeAny = schema
  let def = current._def as unknown as ZodDefWithType

  // Keep unwrapping until we hit a non-wrapper type
  let shouldContinue = true
  while (shouldContinue) {
    const isWrapper =
      def.type === 'optional' ||
      def.type === 'nullable' ||
      def.type === 'default' ||
      def.type === 'effects' ||
      def.type === 'pipeline' ||
      def.type === 'branded'

    if (!isWrapper || !def.innerType) {
      shouldContinue = false
    } else {
      current = def.innerType
      def = current._def as unknown as ZodDefWithType
    }
  }

  return current
}

/**
 * Get field type from Zod schema by introspecting the schema structure
 * Use `as` prop in FormField to override the detected type (e.g., `as="date"` for string fields)
 */
export function getFieldType(schema: ZodTypeAny): FieldType {
  // First, unwrap all wrapper types
  const unwrapped = unwrapSchema(schema)
  const def = unwrapped._def as unknown as ZodDefWithType

  // Handle arrays - extract element type and recurse
  if (def.type === 'array') {
    // ZodArray stores element type in _def.element
    const elementType = def.element
    if (elementType) {
      // Recursively get type from element schema
      return getFieldType(elementType)
    }
    // Fallback for array without element type
    return 'text'
  }

  // Handle nested objects - these should use custom render
  if (def.type === 'object') {
    // Nested objects require custom render, but we'll return 'text' as fallback
    // The FormField component should detect this and suggest custom render
    return 'text'
  }

  // Check for enum (select)
  if (def.type === 'enum') {
    return 'select'
  }

  // Check for boolean
  if (def.type === 'boolean') {
    return 'boolean'
  }

  // Check for number
  if (def.type === 'number') {
    return 'number'
  }

  // Check for string with specific format hints
  if (def.type === 'string') {
    // Check for email format
    if (def.checks?.some((check) => check.kind === 'email')) {
      return 'email'
    }
    // Check for date format (common patterns)
    if (
      def.checks?.some(
        (check) => check.kind === 'datetime' || check.kind === 'date',
      )
    ) {
      return 'date'
    }

    // Default to text for strings
    // Use `as="date"` prop to force date input for string fields
    return 'text'
  }

  // Default fallback
  return 'text'
}

/**
 * Check if field is required (not optional/nullable)
 * Uses unwrapSchema to handle complex wrapper combinations
 */
export function isRequired(schema: ZodTypeAny): boolean {
  const def = schema._def as unknown as ZodDefWithType

  // If it's optional at the top level, it's not required
  if (def.type === 'optional') {
    return false
  }

  // If it has a default, it's not required
  if (def.type === 'default') {
    return false
  }

  // For nullable, check if the inner type is optional
  if (def.type === 'nullable') {
    const inner = def.innerType!
    const innerDef = inner._def as unknown as ZodDefWithType
    // If inner is optional, then the whole thing is optional
    if (innerDef.type === 'optional') {
      return false
    }
    // If inner has default, it's not required
    if (innerDef.type === 'default') {
      return false
    }
    // Otherwise, nullable without optional means it's required (but can be null)
    return true
  }

  // For other wrapper types, unwrap and check
  if (
    def.type === 'effects' ||
    def.type === 'pipeline' ||
    def.type === 'branded'
  ) {
    if (def.innerType) {
      return isRequired(def.innerType)
    }
  }

  // Otherwise, it's required
  return true
}

/**
 * Get enum values if ZodEnum
 */
export function getEnumOptions(schema: ZodTypeAny): Array<string> | null {
  // Use unwrapSchema to handle all wrapper types
  const unwrapped = unwrapSchema(schema)
  const def = unwrapped._def as unknown as ZodDefWithType

  if (def.type === 'enum') {
    return def.values ?? null
  }

  return null
}

/**
 * Get nested field schema from object schema
 */
export function getFieldSchema<T extends Record<string, unknown>>(
  objectSchema: ZodObject<any>,
  name: keyof T & string,
): ZodTypeAny {
  const shape = objectSchema.shape
  const fieldSchema = shape[name]

  if (!fieldSchema) {
    throw new Error(`Field "${name}" not found in schema`)
  }

  return fieldSchema
}

/**
 * Build validators based on validation timing
 */
export function buildFieldValidators(
  schema: ZodTypeAny,
  validateOn: ValidateOn,
): {
  onBlur?: (args: { value: unknown }) => string | undefined
  onChange?: (args: { value: unknown }) => string | undefined
  onSubmit?: (args: { value: unknown }) => string | undefined
} {
  const validators: {
    onBlur?: (args: { value: unknown }) => string | undefined
    onChange?: (args: { value: unknown }) => string | undefined
    onSubmit?: (args: { value: unknown }) => string | undefined
  } = {}

  switch (validateOn) {
    case 'blur':
      validators.onBlur = ({ value }) => getFieldError(schema, value)
      break
    case 'change':
      validators.onChange = ({ value }) => getFieldError(schema, value)
      break
    case 'submit':
      validators.onSubmit = ({ value }) => getFieldError(schema, value)
      break
  }

  return validators
}
