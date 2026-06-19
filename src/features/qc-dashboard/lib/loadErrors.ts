import { isAxiosError } from 'axios'

export const QC_GROUP_LEADER_ONLY_ERROR =
  'Only group leader can view group dashboard statistics'

export function isQcGroupLeaderOnlyError(error: unknown): boolean {
  if (isAxiosError(error) && error.response?.data) {
    const data = error.response.data as Record<string, unknown>
    if (data.error === QC_GROUP_LEADER_ONLY_ERROR) return true
    if (data.message === QC_GROUP_LEADER_ONLY_ERROR) return true
  }

  if (error instanceof Error) {
    return error.message.includes(QC_GROUP_LEADER_ONLY_ERROR)
  }

  return false
}
