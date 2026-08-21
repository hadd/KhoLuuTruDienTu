import type { UseQueryOptions } from '@tanstack/react-query'
import type { ZodObject } from 'zod'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'email'
  | 'multiselect'
  | 'natural-number'
export type ValidateOn = 'blur' | 'change' | 'submit'

// Variants for different field types
export type BooleanVariant = 'switch' | 'checkbox' | 'select'
export type StringVariant = 'text' | 'email' | 'textarea'
export type MultiSelectVariant = 'static' | 'async'
export type FieldVariant = BooleanVariant | StringVariant | MultiSelectVariant

export interface AppFormApi<TData = any> {
  schema: ZodObject<any>
  [key: string]: any // Allow all FormApi methods and properties
}

export interface FormFieldProps<TData, TName extends keyof TData & string> {
  form: AppFormApi<TData>
  name: TName
  label: string

  // Validation
  validateOn?: ValidateOn

  // Override type detection
  as?: FieldType

  // Variant for field rendering (e.g., boolean can be 'switch', 'checkbox', or 'select')
  variant?: FieldVariant

  // Common props
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  description?: string
  className?: string

  // For select fields
  options?: Array<{ value: string; label: string }>

  // For multiselect fields (static variant)
  multiSelectOptions?: Array<unknown>
  getOptionValue?: (item: unknown) => string
  getOptionLabel?: (item: unknown) => string
  getOptionDisplay?: (item: unknown) => React.ReactNode

  // For multiselect fields (async variant)
  queryOptions?: (
    search?: string,
  ) => UseQueryOptions<{ items: Array<unknown> } | undefined>
  excludeIds?: Array<string>
  showSelectedFirst?: boolean
  namespace?: string

  // Custom field render (escape hatch for complex fields)
  render?: (field: any) => React.ReactNode
}

/**
 * Field renderer function type
 * Each field type has its own renderer that takes field state and props
 */
export type FieldRenderer = (
  field: any,
  props: {
    disabled?: boolean
    autoFocus?: boolean
    placeholder?: string
    className?: string
    [key: string]: unknown
  },
  options: Array<string> | Array<{ value: string; label: string }> | null,
  variant?: FieldVariant,
) => React.ReactNode
