import { isPermissionRoleVisible } from '@/features/permissions/lib/roleVisibility'
import type {
  AdminRoleWritePayloadT,
  PermissionCatalogItemT,
  PermissionRoleT,
  RolePermissionRulesT,
  RolePermissionsRecordT,
  UpdateRolePermissionsPayloadT,
} from '@/features/permissions/types'
import { getRoles } from '@/features/user/api/roleClient'
import type { AdminRoleT } from '@/features/user/types'
import { apiClient } from '@/lib/api/apiClient'
import { appendListParams } from '@/lib/api/query-params'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

const EMPTY_RULES: RolePermissionRulesT = { permissions: [], restrictions: [] }

export function parseRoleRules(rules: unknown): RolePermissionRulesT {
  if (typeof rules === 'string') {
    try {
      const parsed: unknown = JSON.parse(rules)
      return parseRoleRules(parsed)
    } catch {
      return EMPTY_RULES
    }
  }

  if (rules && typeof rules === 'object') {
    const candidate = rules as Partial<RolePermissionRulesT>
    return {
      permissions: Array.isArray(candidate.permissions)
        ? candidate.permissions
        : [],
      restrictions: Array.isArray(candidate.restrictions)
        ? candidate.restrictions
        : [],
    }
  }

  return EMPTY_RULES
}

function normalizeRolePermissionsRecord(
  record: RolePermissionsRecordT,
): RolePermissionsRecordT {
  const rules = parseRoleRules(record.rules)

  return {
    ...record,
    rules,
    catalog: record.catalog ?? [],
  }
}

type PermissionsCatalogResponseT =
  | PaginatedResponse<PermissionCatalogItemT>
  | { items?: Array<PermissionCatalogItemT> }

function buildPermissionsCatalogUrl(page?: number): string {
  const searchParams = new URLSearchParams()
  appendListParams(searchParams, { paging: false, page })
  const queryString = searchParams.toString()
  return `/api/v1/admin/permissions/${queryString ? `?${queryString}` : ''}`
}

/** GET /api/v1/admin/permissions/ — dynamic catalog from backend */
export const getPermissionsCatalog = async (): Promise<
  Array<PermissionCatalogItemT>
> => {
  const response = await apiClient.get<PermissionsCatalogResponseT>(
    buildPermissionsCatalogUrl(),
  )
  const data = response.data
  const items = data.items ?? []

  const totalPages =
    'totalPages' in data && typeof data.totalPages === 'number'
      ? data.totalPages
      : 1

  if (totalPages <= 1) {
    return items
  }

  const allItems = [...items]
  for (let page = 2; page <= totalPages; page += 1) {
    const pageResponse = await apiClient.get<PermissionsCatalogResponseT>(
      buildPermissionsCatalogUrl(page),
    )
    allItems.push(...(pageResponse.data.items ?? []))
  }

  return allItems
}

/** GET /api/v1/admin/roles/:id/permissions */
export const getRolePermissions = async (
  roleId: string,
): Promise<RolePermissionsRecordT> => {
  const response = await apiClient.get<
    SingleResourceResponse<RolePermissionsRecordT>
  >(`/api/v1/admin/roles/${roleId}/permissions`)
  return normalizeRolePermissionsRecord(response.data.record)
}

/** GET /api/v1/admin/users/roles */
export const getPermissionRoles = async (): Promise<Array<PermissionRoleT>> => {
  const roles = await getRoles()
  return roles.filter(isPermissionRoleVisible).map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isBaseRole: role.isBaseRole,
  }))
}

/** PUT /api/v1/admin/roles/:id/permissions */
export const updateRolePermissions = async (
  payload: UpdateRolePermissionsPayloadT,
): Promise<RolePermissionsRecordT> => {
  const { roleId, permissions, restrictions, hiddenPermissions } = payload

  await apiClient.put(`/api/v1/admin/roles/${roleId}/permissions`, {
    permissions,
    restrictions,
    hiddenPermissions,
  })

  return getRolePermissions(roleId)
}

/** POST /api/v1/admin/roles/ */
export const createAdminRole = async (
  payload: AdminRoleWritePayloadT,
): Promise<AdminRoleT> => {
  const response = await apiClient.post<SingleResourceResponse<AdminRoleT>>(
    '/api/v1/admin/roles/',
    payload,
  )
  return response.data.record
}

/** DELETE /api/v1/admin/roles/:id */
export const deleteAdminRole = async (roleId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/roles/${roleId}`)
}

/** @deprecated use permissionsCatalogQueryOptions */
export const getSystemFunctions = getPermissionsCatalog
