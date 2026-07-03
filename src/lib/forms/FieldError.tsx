interface FieldErrorProps {
  errors?: Array<unknown>
}

function resolveErrorMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }

  return null
}

/**
 * Displays field validation errors
 * Shows the first error message if any errors exist
 */
export function FieldError({ errors }: FieldErrorProps) {
  if (!errors || errors.length === 0) {
    return null
  }

  const message = resolveErrorMessage(errors[0])
  if (!message) {
    return null
  }

  return <p className="text-sm text-destructive">{message}</p>
}
