import type {
  ArchivePermissionConfigListItemT,
  ArchivePermissionConfigOptionT,
  CreateArchivePermissionConfigPayloadT,
  UpdateArchivePermissionConfigPayloadT,
} from '@/features/archive-permission/types'
import { apiClient } from '@/lib/api/apiClient'

const BASE = '/api/v1/admin/archive-permission-configs'

export async function listArchivePermissionConfigs(
  status?: 'draft' | 'ready' | 'close',
): Promise<{ items: Array<ArchivePermissionConfigListItemT> }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  const response = await apiClient.get<{
    items: Array<ArchivePermissionConfigListItemT>
  }>(`${BASE}${query}`)
  return response.data
}

export async function listReadyArchivePermissionConfigOptions(): Promise<{
  items: Array<ArchivePermissionConfigOptionT>
}> {
  const response = await apiClient.get<{
    items: Array<ArchivePermissionConfigOptionT>
  }>(`${BASE}/options`)
  return response.data
}

export async function getArchivePermissionConfigById(
  id: string,
): Promise<ArchivePermissionConfigListItemT> {
  const response = await apiClient.get<{
    record: ArchivePermissionConfigListItemT
  }>(`${BASE}/${encodeURIComponent(id)}`)
  return response.data.record
}

export async function createArchivePermissionConfig(
  payload: CreateArchivePermissionConfigPayloadT,
): Promise<ArchivePermissionConfigListItemT> {
  const response = await apiClient.post<{
    record: ArchivePermissionConfigListItemT
  }>(BASE, payload)
  return { ...response.data.record, slots: [] }
}

export async function updateArchivePermissionConfig(
  id: string,
  payload: UpdateArchivePermissionConfigPayloadT,
): Promise<ArchivePermissionConfigListItemT> {
  const response = await apiClient.put<{
    record: ArchivePermissionConfigListItemT
  }>(`${BASE}/${encodeURIComponent(id)}`, payload)
  return response.data.record
}

export async function deleteArchivePermissionConfig(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${encodeURIComponent(id)}`)
}
