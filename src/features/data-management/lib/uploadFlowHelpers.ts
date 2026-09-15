import { isAxiosError } from 'axios'

import type { DataManagementUploadErrorCode } from '@/features/data-management/api/dataManagementClient'
import { isDataManagementUploadError } from '@/features/data-management/api/dataManagementClient'

function normalizeApiErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeApiErrorMessage(item))
      .filter((part): part is string => Boolean(part))
    return parts.length > 0 ? parts.join('; ') : undefined
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      normalizeApiErrorMessage(record.message) ??
      normalizeApiErrorMessage(record.error) ??
      normalizeApiErrorMessage(record.summary)
    )
  }
  return undefined
}

export function resolveUploadFlowErrorMessage(
  err: unknown,
  options: {
    translateUploadError: (code: DataManagementUploadErrorCode) => string
    defaultMessage: string
  },
): string {
  if (isDataManagementUploadError(err)) {
    return options.translateUploadError(err.code)
  }

  if (isAxiosError(err)) {
    const responseData = err.response?.data as
      | { message?: unknown; error?: unknown }
      | undefined
    const apiMessage =
      normalizeApiErrorMessage(responseData?.error) ??
      normalizeApiErrorMessage(responseData?.message)
    if (apiMessage) {
      return apiMessage
    }
    if (err.response?.status) {
      return `${options.defaultMessage} (HTTP ${err.response.status})`
    }
    if (err.message?.trim()) {
      return err.message.trim()
    }
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim()
  }

  return options.defaultMessage
}
