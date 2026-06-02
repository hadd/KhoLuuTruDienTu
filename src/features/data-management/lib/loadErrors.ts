import { isAxiosError } from 'axios'

export const NO_ASSIGNED_DOSSIER_ERROR = 'No assigned dossier found'

export class NoAssignedDossierError extends Error {
  constructor() {
    super(NO_ASSIGNED_DOSSIER_ERROR)
    this.name = 'NoAssignedDossierError'
  }
}

export function createNoAssignedDossierError(): NoAssignedDossierError {
  return new NoAssignedDossierError()
}

export function isNoAssignedDossierError(error: unknown): boolean {
  if (error instanceof NoAssignedDossierError) return true
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
