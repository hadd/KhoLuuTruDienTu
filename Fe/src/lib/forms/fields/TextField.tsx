import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import type { FieldRenderer, FieldVariant } from '../types'

export const renderTextField: FieldRenderer = (
  field,
  props,
  _options,
  variant,
) => {
  const commonInputProps = {
    id: field.name,
    disabled: props.disabled ?? false,
    autoFocus: props.autoFocus,
    placeholder: props.placeholder,
    className: props.className,
  }

  // If variant is 'textarea', render as textarea even for text type
  if (variant === 'textarea') {
    return (
      <Textarea
        value={field.state.value ?? ''}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        {...commonInputProps}
      />
    )
  }

  return (
    <Input
      type={variant === 'email' ? 'email' : 'text'}
      value={field.state.value ?? ''}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      {...commonInputProps}
    />
  )
}
