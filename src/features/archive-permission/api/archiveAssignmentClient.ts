import type {
  ArchiveGroupBindingT,
  ArchiveUserAssignmentT,
  ReplaceArchiveUserAssignmentsPayloadT,
  UpsertArchiveGroupBindingPayloadT,
} from '@/features/archive-permission/types'
import { apiClient } from '@/lib/api/apiClient'

const BASE = '/api/v1/admin/archive-assignments'

export async function getArchiveGroupBinding(
  groupId: string,
): Promise<{ record: ArchiveGroupBindingT | null }> {
  const response = await apiClient.get<{ record: ArchiveGroupBindingT | null }>(
    `${BASE}/groups/${encodeURIComponent(groupId)}`,
  )
  return response.data
}

export async function upsertArchiveGroupBinding(
  groupId: string,
  payload: UpsertArchiveGroupBindingPayloadT,
): Promise<{ record: ArchiveGroupBindingT }> {
  const response = await apiClient.put<{ record: ArchiveGroupBindingT }>(
    `${BASE}/groups/${encodeURIComponent(groupId)}`,
    payload,
  )
  return response.data
}

export async function setGroupMemberArchiveSlot(
  groupId: string,
  memberId: string,
  archivePermissionSlotCode: string | null,
): Promise<{
  record: { archivePermissionSlotCode: string | null }
}> {
  const response = await apiClient.put<{
    record: { archivePermissionSlotCode: string | null }
  }>(
    `${BASE}/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}/slot`,
    { archivePermissionSlotCode },
  )
  return response.data
}

export async function getArchiveUserAssignments(
  userId: string,
): Promise<{ items: Array<ArchiveUserAssignmentT> }> {
  const response = await apiClient.get<{
    items: Array<ArchiveUserAssignmentT>
  }>(`${BASE}/users/${encodeURIComponent(userId)}`)
  return response.data
}

export async function replaceArchiveUserAssignments(
  userId: string,
  payload: ReplaceArchiveUserAssignmentsPayloadT,
): Promise<{ items: Array<ArchiveUserAssignmentT> }> {
  const response = await apiClient.put<{
    items: Array<ArchiveUserAssignmentT>
  }>(`${BASE}/users/${encodeURIComponent(userId)}`, payload)
  return response.data
}
