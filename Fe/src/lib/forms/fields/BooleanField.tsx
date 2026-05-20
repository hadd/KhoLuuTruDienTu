import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import type { BooleanVariant, FieldRenderer } from '../types'

export const renderBooleanField: FieldRenderer = (
  field,
  props,
  _options,
  variant,
) => {
  const isDisabled = props.disabled ?? false
  const booleanVariant = (variant as BooleanVariant | undefined) ?? 'switch'

  if (booleanVariant === 'checkbox') {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={field.name}
          checked={field.state.value ?? false}
          onCheckedChange={(checked) => field.handleChange(checked)}
          disabled={isDisabled}
        />
      </div>
    )
  }

  if (booleanVariant === 'select') {
    const booleanOptions = [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ]
    return (
      <Select
        value={String(field.state.value ?? false)}
        onValueChange={(value) => field.handleChange(value === 'true')}
        disabled={isDisabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {booleanOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // Default: switch
  return (
    <Switch
      id={field.name}
      checked={field.state.value ?? false}
      onCheckedChange={(checked) => field.handleChange(checked)}
      disabled={isDisabled}
    />
  )
}
