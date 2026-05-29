import { Input } from '@/components/ui/input'

import type { FieldRenderer } from '../types'

export const renderDateField: FieldRenderer = (field, props) => {
  const commonInputProps = {
    id: field.name,
    disabled: props.disabled ?? false,
    autoFocus: props.autoFocus,
    placeholder: props.placeholder,
    className: props.className,
  }

  return (
    <Input
      type="date"
      value={field.state.value ?? ''}
      onChange={(event) =>
        field.handleChange(event.target.value ? event.target.value : '')
      }
      onBlur={field.handleBlur}
      {...commonInputProps}
    />
  )
}
