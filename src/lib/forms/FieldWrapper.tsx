import { RequiredMark } from '@/components/common/RequiredMark'
import { Label } from '@/components/ui/label'

import { FieldError } from './FieldError'

interface FieldWrapperProps {
  name: string
  label: string
  required?: boolean
  description?: string
  errors?: Array<string>
  children: React.ReactNode
}

/**
 * Reusable wrapper for form fields
 * Handles label, required mark, description, and error display
 */
export function FieldWrapper({
  name,
  label,
  required,
  description,
  errors,
  children,
}: FieldWrapperProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <RequiredMark />}
      </Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <FieldError errors={errors} />
    </div>
  )
}
