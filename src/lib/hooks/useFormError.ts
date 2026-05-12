import { useCallback, useState } from 'react'

export interface UseFormErrorReturn {
  formError: string | null
  setFormError: (error: string | null) => void
  clearFormError: () => void
}

/**
 * Hook for form-level error state (e.g. mutation onError).
 * Use with mutation onError: setFormError(error.message) and clear before submit.
 */
export function useFormError(): UseFormErrorReturn {
  const [formError, setFormError] = useState<string | null>(null)

  const clearFormError = useCallback(() => {
    setFormError(null)
  }, [])

  return { formError, setFormError, clearFormError }
}
