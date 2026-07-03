import { useForm } from '@tanstack/react-form'
import type { ZodObject, ZodRawShape } from 'zod'

import type { AppFormApi } from './types'

interface UseAppFormOptions<TData extends Record<string, unknown>> {
  schema: ZodObject<ZodRawShape>
  defaultValues: TData
  onSubmit: (data: { value: TData }) => Promise<void>
}

/**
 * Enhanced form hook that wraps TanStack Form with schema reference
 * This allows FormField components to access the schema for auto-detection
 */
export function useAppForm<TData extends Record<string, unknown>>(
  options: UseAppFormOptions<TData>,
): AppFormApi<TData> {
  const form = useForm({
    defaultValues: options.defaultValues,
    validators: {
      onSubmit: options.schema as never,
    },
    onSubmit: options.onSubmit,
  })

  // Extend form with schema reference for FormField auto-detection
  // Use Object.assign to preserve all form methods and properties
  const extendedForm = Object.assign(form, { schema: options.schema })
  return extendedForm as unknown as AppFormApi<TData>
}
