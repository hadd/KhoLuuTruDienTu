import { Input } from '@/components/ui/input'
import type { FieldRenderer } from '../types'

export const renderNaturalNumberField: FieldRenderer = (field, props) => {
  const commonInputProps = {
    id: field.name,
    disabled: props.disabled ?? false,
    autoFocus: props.autoFocus,
    placeholder: props.placeholder,
    className: props.className,
  }

  return (
    <Input
      type="text" // 👈 Dùng type="text" để kiểm soát chặt chẽ ký tự đầu vào
      inputMode="numeric"
      value={
        field.state.value !== undefined && !Number.isNaN(field.state.value)
          ? String(field.state.value)
          : ''
      }
      onKeyDown={(event) => {
        // Chặn trực tiếp các ký tự không phải số và dấu
        if (['e', 'E', '+', '-', '.', ','].includes(event.key)) {
          event.preventDefault()
        }
      }}
      onChange={(event) => {
        // Lọc sạch chữ cái và ký tự đặc biệt (kể cả khi copy/paste)
        const cleanValue = event.target.value.replace(/\D/g, '')

        if (cleanValue === '') {
          field.handleChange(undefined)
        } else {
          const parsed = parseInt(cleanValue, 10)
          field.handleChange(Number.isNaN(parsed) ? undefined : parsed)
        }
      }}
      onBlur={field.handleBlur}
      {...commonInputProps}
    />
  )
}