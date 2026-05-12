import { Input } from '@/components/ui/input'

import type { FieldRenderer } from '../types'

export const renderEmailField: FieldRenderer = (field, props) => {
  const commonInputProps = {
    id: field.name,
    disabled: props.disabled ?? false,
    autoFocus: props.autoFocus,
    placeholder: props.placeholder,
    className: props.className,
  }

  return (
    <Input
      type="email"
      value={field.state.value ?? ''}
      onChange={(event) => field.handleChange(event.target.value)}
      onBlur={field.handleBlur}
      {...commonInputProps}
    />
  )
}
