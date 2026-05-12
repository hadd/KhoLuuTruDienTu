interface FieldErrorProps {
  errors?: Array<string>
}

/**
 * Displays field validation errors
 * Shows the first error message if any errors exist
 */
export function FieldError({ errors }: FieldErrorProps) {
  if (!errors || errors.length === 0) {
    return null
  }

  return <p className="text-sm text-destructive">{errors[0]}</p>
}
