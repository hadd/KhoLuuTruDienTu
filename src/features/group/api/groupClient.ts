import type {
  AdminGroupT,
  AdminGroupsListResponseT,
  AssignGroupByFolderPayloadT,
  AssignGroupByFolderResponseT,
  CreateAdminGroupPayloadT,
  GroupFieldTemplateT,
  MetadataSchemaResponseT,
  UpdateAdminGroupPayloadT,
  UpdateGroupFieldTemplatePayloadT,
} from '@/features/group/types'
import { normalizeAllowedFields } from '@/features/group/lib/field-assignment'
import { apiClient } from '@/lib/api/apiClient'
import type { SingleResourceResponse } from '@/types/api'

function normalizeFieldTemplate(data: GroupFieldTemplateT): GroupFieldTemplateT {
  return {
    ...data,
    editors: (data.editors ?? []).map((editor) => ({
      ...editor,
      allowedFields: normalizeAllowedFields(editor.allowedFields),
    })),
  }
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

/** GET /api/v1/admin/groups/metadata-schema */
export const getGroupMetadataSchema =
  async (): Promise<MetadataSchemaResponseT> => {
    const response = await apiClient.get<MetadataSchemaResponseT>(
      '/api/v1/admin/groups/metadata-schema',
    )
    return response.data
  }

/** GET /api/v1/admin/groups/:id/field-template */
export const getGroupFieldTemplate = async (
  groupId: string,
): Promise<GroupFieldTemplateT> => {
  const response = await apiClient.get<
    GroupFieldTemplateT | SingleResourceResponse<GroupFieldTemplateT>
  >(`/api/v1/admin/groups/${encodeURIComponent(groupId)}/field-template`)

  const data =
    'record' in response.data && response.data.record
      ? response.data.record
      : response.data

  return normalizeFieldTemplate(data)
}

/** PATCH /api/v1/admin/groups/:id/field-template */
export const updateGroupFieldTemplate = async (
  groupId: string,
  payload: UpdateGroupFieldTemplatePayloadT,
): Promise<GroupFieldTemplateT> => {
  const response = await apiClient.patch<
    GroupFieldTemplateT | SingleResourceResponse<GroupFieldTemplateT>
  >(
    `/api/v1/admin/groups/${encodeURIComponent(groupId)}/field-template`,
    payload,
  )

  const data =
    'record' in response.data && response.data.record
      ? response.data.record
      : response.data

  return normalizeFieldTemplate(data)
}
