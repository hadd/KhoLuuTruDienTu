import type {
  AdminGroupsListResponseT,
  AdminGroupT,
  AssignGroupByFolderPayloadT,
  AssignGroupByFolderResponseT,
  AvailableEditorsResponseT,
  CreateAdminGroupPayloadT,
  GroupAssignedDossierT,
  UpdateAdminGroupPayloadT,
} from '@/features/group/types'
import { apiClient } from '@/lib/api/apiClient'
import type { PaginatedResponse, SingleResourceResponse } from '@/types/api'

const ASSIGNED_DOSSIERS_PAGE_LIMIT = 50

export const getAvailableEditors =
  async (): Promise<AvailableEditorsResponseT> => {
    const response = await apiClient.get<AvailableEditorsResponseT>(
      '/api/v1/admin/groups/available-editors',
    )
    return response.data
  }

export type GroupProjectOptionT = {
  projectCode: string
  projectName: string
}

export const getAdminGroups = async (): Promise<AdminGroupsListResponseT> => {
  const response = await apiClient.get<AdminGroupsListResponseT>(
    '/api/v1/admin/groups/',
  )
  return response.data
}

export const createAdminGroup = async (
  payload: CreateAdminGroupPayloadT,
): Promise<AdminGroupT> => {
  const response = await apiClient.post<SingleResourceResponse<AdminGroupT>>(
    '/api/v1/admin/groups/',
    payload,
  )
  return response.data.record
}

export const updateAdminGroup = async (
  groupId: string,
  payload: UpdateAdminGroupPayloadT,
): Promise<AdminGroupT> => {
  const response = await apiClient.patch<SingleResourceResponse<AdminGroupT>>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}`,
    payload,
  )
  return response.data.record
}

/** POST /api/v1/admin/groups/:id/assign-by-folder */
export const assignGroupByFolder = async (
  groupId: string,
  payload: AssignGroupByFolderPayloadT,
): Promise<AssignGroupByFolderResponseT> => {
  const response = await apiClient.post<AssignGroupByFolderResponseT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/assign-by-folder`,
    payload,
  )
  return response.data
}

export const deleteAdminGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`)
}

/** GET /api/v1/dossiers/?assignGroupId= — fetches all pages, filters by groupId */
export const getDossiersByAssignGroupId = async (
  groupId: string,
): Promise<Array<GroupAssignedDossierT>> => {
  const items: Array<GroupAssignedDossierT> = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const response = await apiClient.get<PaginatedResponse<GroupAssignedDossierT>>(
      '/api/v1/dossiers/',
      {
        params: {
          assignGroupId: groupId,
          page,
          limit: ASSIGNED_DOSSIERS_PAGE_LIMIT,
        },
      },
    )

    const data = response.data
    items.push(...data.items)
    hasNextPage = data.hasNextPage === true
    page += 1
  }

  return items.filter((dossier) => dossier.assignedGroupId === groupId)
}
