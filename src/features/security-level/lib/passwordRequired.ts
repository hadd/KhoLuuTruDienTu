import { parsePasswordRequiredError } from '@/features/security-level/lib/securityAccessTokenStore'

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function getPasswordRequiredFromError(error: unknown) {
  return parsePasswordRequiredError(getErrorMessage(error))
}
