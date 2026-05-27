import { isAxiosError } from 'axios'

const NO_ASSIGNED_DOSSIER_ERROR = 'No assigned dossier found'

export function isNoAssignedDossierError(error: unknown): boolean {
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data as Record<string, unknown>
    if (data.error === NO_ASSIGNED_DOSSIER_ERROR) return true
    if (data.message === NO_ASSIGNED_DOSSIER_ERROR) return true
  }

  if (error instanceof Error) {
    return error.message.includes(NO_ASSIGNED_DOSSIER_ERROR)
  }

  return false
}
