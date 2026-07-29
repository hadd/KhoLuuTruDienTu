import type {
  CreateSecurityLevelPayloadT,
  GetSecurityLevelsParamsT,
  PatchSecurityLevelRulesPayloadT,
  SecurityLevelRulesResponseT,
  SecurityLevelT,
  SecurityPermissionDefT,
  UpdateSecurityLevelPayloadT,
} from '@/features/security-level/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

export async function getSecurityLevels(
  params?: GetSecurityLevelsParamsT,
): Promise<PaginatedResponse<SecurityLevelT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  const queryString = searchParams.toString()
  const url = `/api/v1/security-levels${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<PaginatedResponse<SecurityLevelT>>(url)
  return response.data
}

export async function getActiveSecurityLevels(): Promise<{
  items: Array<SecurityLevelT>
}> {
  const response = await apiClient.get<{ items: Array<SecurityLevelT> }>(
    '/api/v1/security-levels/active',
  )
  return response.data
}

export async function createSecurityLevelRecord(
  payload: CreateSecurityLevelPayloadT,
): Promise<SecurityLevelT> {
  const response = await apiClient.post<SingleResourceResponse<SecurityLevelT>>(
    '/api/v1/security-levels',
    payload,
  )
  return response.data.record
}

export async function updateSecurityLevelRecord(
  id: string,
  payload: UpdateSecurityLevelPayloadT,
): Promise<SecurityLevelT> {
  const response = await apiClient.put<SingleResourceResponse<SecurityLevelT>>(
    `/api/v1/security-levels/${encodeURIComponent(id)}`,
    payload,
  )
  return response.data.record
}

export async function deleteSecurityLevelRecord(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/security-levels/${encodeURIComponent(id)}`)
}

export async function getSecurityLevelRules(
  id: string,
): Promise<SecurityLevelRulesResponseT> {
  const response = await apiClient.get<SecurityLevelRulesResponseT>(
    `/api/v1/security-levels/${encodeURIComponent(id)}/rules`,
  )
  return response.data
}

export async function patchSecurityLevelRules(
  id: string,
  payload: PatchSecurityLevelRulesPayloadT,
): Promise<SecurityLevelRulesResponseT> {
  const response = await apiClient.patch<SecurityLevelRulesResponseT>(
    `/api/v1/security-levels/${encodeURIComponent(id)}/rules`,
    payload,
  )
  return response.data
}

function normalizeSecurityAccessPayload(
  data: unknown,
): { token: string; expiresIn: number } {
  const raw =
    data && typeof data === 'object' && 'record' in data
      ? (data as { record?: unknown }).record
      : data
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid security access response')
  }
  const token = (raw as { token?: string }).token
  const expiresIn = (raw as { expiresIn?: number }).expiresIn
  if (!token?.trim()) {
    throw new Error('Invalid security access response')
  }
  return {
    token,
    expiresIn:
      typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
        ? expiresIn
        : 15 * 60,
  }
}

export async function verifySecurityLevelAccess(input: {
  securityLevelId: string
  password: string
}): Promise<{ token: string; expiresIn: number }> {
  const response = await apiClient.post<unknown>(
    '/api/v1/security-levels/verify-access',
    input,
  )
  return normalizeSecurityAccessPayload(response.data)
}

export async function verifyDossierAccess(input: {
  dossierId: string
  password: string
}): Promise<{ token: string; expiresIn: number }> {
  const response = await apiClient.post<unknown>(
    `/api/v1/dossiers/${encodeURIComponent(input.dossierId)}/verify-access`,
    { password: input.password },
  )
  return normalizeSecurityAccessPayload(response.data)
}

export async function getActiveSecurityPermissionDefs(): Promise<{
  items: Array<SecurityPermissionDefT>
}> {
  const response = await apiClient.get<{ items: Array<SecurityPermissionDefT> }>(
    '/api/v1/security-permission-defs/active',
  )
  return response.data
}

export async function getSecurityPermissionDefs(params?: {
  page?: number
  limit?: number
  search?: string
}): Promise<PaginatedResponse<SecurityPermissionDefT>> {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })
  const qs = searchParams.toString()
  const response = await apiClient.get<PaginatedResponse<SecurityPermissionDefT>>(
    `/api/v1/security-permission-defs${qs ? `?${qs}` : ''}`,
  )
  return response.data
}

export async function createSecurityPermissionDef(payload: {
  key: string
  name: string
  description?: string
}): Promise<SecurityPermissionDefT> {
  const response = await apiClient.post<
    SingleResourceResponse<SecurityPermissionDefT>
  >('/api/v1/security-permission-defs', payload)
  return response.data.record
}

export async function updateSecurityPermissionDef(
  id: string,
  payload: { name?: string; description?: string; isActive?: boolean },
): Promise<SecurityPermissionDefT> {
  const response = await apiClient.put<
    SingleResourceResponse<SecurityPermissionDefT>
  >(`/api/v1/security-permission-defs/${encodeURIComponent(id)}`, payload)
  return response.data.record
}

export async function deleteSecurityPermissionDef(id: string): Promise<void> {
  await apiClient.delete(
    `/api/v1/security-permission-defs/${encodeURIComponent(id)}`,
  )
}
