import { DatePickerMask } from '@/components/common/date/DatePickerMask'

import type { FieldRenderer } from '../types'

export const renderDateField: FieldRenderer = (field, props) => {
  return (
    <DatePickerMask
      id={field.name}
      value={field.state.value ?? ''}
      onChange={(val) => field.handleChange(val ?? '')}
      disabled={props.disabled ?? false}
      placeholder={props.placeholder}
      className={props.className}
    />
  )
}
