import { isAxiosError } from 'axios'

import type { DataManagementUploadErrorCode } from '@/features/data-management/api/dataManagementClient'
import { isDataManagementUploadError } from '@/features/data-management/api/dataManagementClient'

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
      | { message?: string; error?: string }
      | undefined
    const apiMessage = responseData?.error || responseData?.message
    if (apiMessage?.trim()) {
      return apiMessage.trim()
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
