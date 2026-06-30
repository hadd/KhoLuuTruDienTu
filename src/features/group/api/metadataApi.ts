import type { MetadataPermissionConfigListItemT } from '@/features/data-config/types'
import type {
  AssignGroupMetadataPermissionConfigPayloadT,
  UpdateGroupPermissionAssignmentsPayloadT,
} from '@/features/group/types'
import { apiClient } from '@/lib/api/apiClient'

const METADATA_PERMISSION_CONFIGS_PATH =
  '/api/v1/admin/metadata-permission-configs'
const GROUPS_PATH = '/api/v1/admin/groups'

function groupPath(groupId: string, suffix: string) {
  return `${GROUPS_PATH}/${encodeURIComponent(groupId)}${suffix}`
}

/** GET /api/v1/admin/metadata-permission-configs/ */
export const getMetadataPermissionConfigs = async (): Promise<
  Array<MetadataPermissionConfigListItemT>
> => {
  const response = await apiClient.get<
    Array<MetadataPermissionConfigListItemT>
  >(`${METADATA_PERMISSION_CONFIGS_PATH}/`)
  return response.data
}

/** PATCH /api/v1/admin/groups/:id/metadata-permission-config */
export const updateGroupMetadataPermissionConfig = async (
  groupId: string,
  payload: AssignGroupMetadataPermissionConfigPayloadT,
): Promise<void> => {
  await apiClient.patch(
    groupPath(groupId, '/metadata-permission-config'),
    payload,
  )
}

/** PUT /api/v1/admin/groups/:id/permission-assignments */
export const updateGroupPermissionAssignments = async (
  groupId: string,
  payload: UpdateGroupPermissionAssignmentsPayloadT,
): Promise<void> => {
  await apiClient.put(groupPath(groupId, '/permission-assignments'), payload)
}
