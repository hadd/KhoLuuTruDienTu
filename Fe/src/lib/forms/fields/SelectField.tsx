import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { FieldRenderer } from '../types'

export const renderSelectField: FieldRenderer = (field, props, options) => {
  const isDisabled = props.disabled ?? false
  const selectOptions = options ?? []
  // Handle both string[] and { value, label }[] formats
  const isStringArray =
    selectOptions.length > 0 && typeof selectOptions[0] === 'string'

  return (
    <Select
      value={field.state.value ?? ''}
      onValueChange={field.handleChange}
      disabled={isDisabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {isStringArray
          ? (selectOptions as Array<string>).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))
          : (selectOptions as Array<{ value: string; label: string }>).map(
              (option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ),
            )}
      </SelectContent>
    </Select>
  )
}
