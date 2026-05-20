import { Input } from '@/components/ui/input'

import type { FieldRenderer } from '../types'

export const renderNumberField: FieldRenderer = (field, props) => {
  const commonInputProps = {
    id: field.name,
    disabled: props.disabled ?? false,
    autoFocus: props.autoFocus,
    placeholder: props.placeholder,
    className: props.className,
  }

  return (
    <Input
      type="number"
      value={field.state.value ?? ''}
      onChange={(event) =>
        field.handleChange(
          event.target.value ? Number(event.target.value) : undefined,
        )
      }
      onBlur={field.handleBlur}
      {...commonInputProps}
    />
  )
}
