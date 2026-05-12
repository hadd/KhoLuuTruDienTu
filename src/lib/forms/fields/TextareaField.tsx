import { Textarea } from '@/components/ui/textarea'

import type { FieldRenderer } from '../types'

export const renderTextareaField: FieldRenderer = (field, props) => {
  const commonInputProps = {
    id: field.name,
    disabled: props.disabled ?? false,
    autoFocus: props.autoFocus,
    placeholder: props.placeholder,
    className: props.className,
  }

  return (
    <Textarea
      value={field.state.value ?? ''}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      {...commonInputProps}
    />
  )
}
