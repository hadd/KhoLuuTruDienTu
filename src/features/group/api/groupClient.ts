import type {
  AdminGroupsListParamsT,
  AdminGroupsListResponseT,
  AdminGroupT,
  AssignGroupByFolderPayloadT,
  AssignGroupByFolderResponseT,
  AvailableEditorsResponseT,
  CreateAdminGroupPayloadT,
  GroupAssignedDossierT,
  GroupAssignedDossiersResponseT,
  GroupAssignmentCountsT,
  GroupMemberAssignmentsQueryT,
  GroupMemberAssignmentsResponseT,
  UpdateAdminGroupPayloadT,
} from '@/features/group/types'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

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

export const getAdminGroups = async (
  params: AdminGroupsListParamsT = {},
): Promise<AdminGroupsListResponseT> => {
  const response = await apiClient.get<AdminGroupsListResponseT>(
    '/api/v1/admin/groups/',
    {
      params: {
        ...(params.page != null ? { page: params.page } : {}),
        ...(params.limit != null ? { limit: params.limit } : {}),
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.projectCode ? { projectCode: params.projectCode } : {}),
      },
    },
  )
  return response.data
}

export const getAdminGroupById = async (groupId: string): Promise<AdminGroupT> => {
  const response = await apiClient.get<SingleResourceResponse<AdminGroupT>>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}`,
  )
  return response.data.record
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

export type RevokeGroupMemberAssignmentsPayloadT = {
  userId: string
}

export type RevokeGroupMemberAssignmentsResponseT = {
  group: { id: string; name: string }
  userId: string
  totalTargeted: number
  totalRevoked: number
  totalSkipped: number
  revokedDossierIds: Array<string>
  assignmentsCancelled: number
  skipped: Array<{ dossierId: string; folderId: string; reason: string }>
}

/** POST /api/v1/admin/groups/:id/revoke-by-member */
export const revokeGroupMemberAssignments = async (
  groupId: string,
  payload: RevokeGroupMemberAssignmentsPayloadT,
): Promise<RevokeGroupMemberAssignmentsResponseT> => {
  const response = await apiClient.post<RevokeGroupMemberAssignmentsResponseT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/revoke-by-member`,
    payload,
  )
  return response.data
}

export type RevokeGroupAllAssignmentsResponseT = {
  group: { id: string; name: string }
  totalTargeted: number
  totalRevoked: number
  totalSkipped: number
  revokedDossierIds: Array<string>
  assignmentsCancelled: number
  skipped: Array<{ dossierId: string; folderId: string; reason: string }>
}

/** POST /api/v1/admin/groups/:id/revoke-all */
export const revokeGroupAllAssignments = async (
  groupId: string,
): Promise<RevokeGroupAllAssignmentsResponseT> => {
  const response = await apiClient.post<RevokeGroupAllAssignmentsResponseT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/revoke-all`,
  )
  return response.data
}

export const deleteAdminGroup = async (groupId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/admin/groups/${encodeURIComponent(groupId)}`)
}

/** GET /api/v1/admin/groups/:id/assigned-dossiers */
export const getDossiersByAssignGroupId = async (
  groupId: string,
): Promise<Array<GroupAssignedDossierT>> => {
  const response = await apiClient.get<GroupAssignedDossiersResponseT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/assigned-dossiers`,
  )
  return response.data.dossiers
}

/** GET /api/v1/admin/groups/:id/assignment-counts */
export const getGroupAssignmentCounts = async (
  groupId: string,
): Promise<GroupAssignmentCountsT> => {
  const response = await apiClient.get<GroupAssignmentCountsT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/assignment-counts`,
  )
  return response.data
}

/** GET /api/v1/admin/groups/:id/member-assignments */
export const getGroupMemberAssignments = async (
  groupId: string,
  query: GroupMemberAssignmentsQueryT,
): Promise<GroupMemberAssignmentsResponseT> => {
  const response = await apiClient.get<GroupMemberAssignmentsResponseT>(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/member-assignments`,
    {
      params: {
        userId: query.userId,
        kind: query.kind,
        ...(query.level != null ? { level: query.level } : {}),
      },
    },
  )
  return response.data
}
