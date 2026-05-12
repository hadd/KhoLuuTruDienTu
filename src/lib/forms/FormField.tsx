import { getFieldRenderer } from './fields'
import { FieldWrapper } from './FieldWrapper'
import {
  buildFieldValidators,
  getEnumOptions,
  getFieldSchema,
  getFieldType,
  isRequired,
} from './schema-utils'
import type { FormFieldProps } from './types'

/**
 * Smart form field component that auto-detects field type from Zod schema
 * Supports custom rendering via render prop for complex fields
 */
export function FormField<
  TData extends Record<string, unknown>,
  TName extends keyof TData & string,
>({
  form,
  name,
  label,
  validateOn = 'blur',
  as,
  variant,
  render,
  options,
  description,
  disabled,
  autoFocus,
  placeholder,
  className,
  multiSelectOptions,
  getOptionValue,
  getOptionLabel,
  getOptionDisplay,
  queryOptions,
  excludeIds,
  showSelectedFirst,
  namespace,
  ...inputProps
}: FormFieldProps<TData, TName>) {
  const fieldSchema = getFieldSchema(form.schema, name)
  const fieldType = as ?? getFieldType(fieldSchema)
  const required = isRequired(fieldSchema)
  const validators = buildFieldValidators(fieldSchema, validateOn)
  const enumOptions = getEnumOptions(fieldSchema)

  // Access form.Field - form is AppFormApi which extends FormApi, so Field exists at runtime
  // TypeScript needs help recognizing this, so we use a type assertion
  const formApi = form as unknown as {
    Field: (props: any) => React.ReactElement
  }

  return (
    <formApi.Field name={name} validators={validators}>
      {(field: any) => (
        <FieldWrapper
          name={name}
          label={label}
          required={required}
          description={description}
          errors={field.state.meta.errors}
        >
          {/* Custom render takes priority */}
          {render
            ? render(field)
            : getFieldRenderer(fieldType, variant)(
                field,
                {
                  disabled: disabled ?? false,
                  autoFocus,
                  placeholder,
                  className,
                  multiSelectOptions,
                  getOptionValue,
                  getOptionLabel,
                  getOptionDisplay,
                  queryOptions,
                  excludeIds,
                  showSelectedFirst,
                  namespace,
                  ...inputProps,
                },
                options ?? enumOptions,
                variant,
              )}
        </FieldWrapper>
      )}
    </formApi.Field>
  )
}
