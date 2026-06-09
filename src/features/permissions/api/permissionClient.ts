import type {
  PermissionGrantT,
  PermissionMatrixT,
  PermissionRoleT,
  SystemFunctionT,
  UpdatePermissionGrantPayloadT,
} from '@/features/permissions/types'
// import { apiClient } from '@/lib/api/apiClient'
// import type { SingleResourceResponse } from '@/types/api'

import {
  initialMockGrants,
  mockPermissionRoles,
  mockSystemFunctions,
} from './mockData'

// TODO: swap to real API when backend is ready
// GET  /api/v1/admin/permissions/roles
// GET  /api/v1/admin/permissions/functions
// GET  /api/v1/admin/permissions/matrix
// PUT  /api/v1/admin/permissions/matrix  body: { roleId, functionId, granted: boolean }

let mockGrantsStore: PermissionGrantT[] = [...initialMockGrants]

function grantKey(roleId: string, functionId: string): string {
  return `${roleId}:${functionId}`
}

function toGrantSet(grants: PermissionGrantT[]): Set<string> {
  return new Set(grants.map((g) => grantKey(g.roleId, g.functionId)))
}

const MOCK_DELAY_MS = 200

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const getPermissionRoles = async (): Promise<PermissionRoleT[]> => {
  // const response = await apiClient.get<SingleResourceResponse<PermissionRoleT[]>>(
  //   '/api/v1/admin/permissions/roles',
  // )
  // return response.data.record ?? []
  await delay(MOCK_DELAY_MS)
  return [...mockPermissionRoles]
}

export const getSystemFunctions = async (): Promise<SystemFunctionT[]> => {
  // const response = await apiClient.get<SingleResourceResponse<SystemFunctionT[]>>(
  //   '/api/v1/admin/permissions/functions',
  // )
  // return response.data.record ?? []
  await delay(MOCK_DELAY_MS)
  return [...mockSystemFunctions]
}

export const getPermissionMatrix = async (): Promise<PermissionMatrixT> => {
  // const response = await apiClient.get<SingleResourceResponse<PermissionGrantT[]>>(
  //   '/api/v1/admin/permissions/matrix',
  // )
  // return response.data.record ?? []
  await delay(MOCK_DELAY_MS)
  return [...mockGrantsStore]
}

export function isGrantKeyGranted(
  grants: PermissionGrantT[],
  roleId: string,
  functionId: string,
): boolean {
  return toGrantSet(grants).has(grantKey(roleId, functionId))
}

export const updatePermissionGrant = async (
  payload: UpdatePermissionGrantPayloadT,
): Promise<PermissionMatrixT> => {
  // await apiClient.put('/api/v1/admin/permissions/matrix', payload)
  await delay(MOCK_DELAY_MS)

  const { roleId, functionId, granted } = payload
  const key = grantKey(roleId, functionId)

  if (granted) {
    if (!toGrantSet(mockGrantsStore).has(key)) {
      mockGrantsStore = [...mockGrantsStore, { roleId, functionId }]
    }
  } else {
    mockGrantsStore = mockGrantsStore.filter(
      (g) => !(g.roleId === roleId && g.functionId === functionId),
    )
  }

  return [...mockGrantsStore]
}
