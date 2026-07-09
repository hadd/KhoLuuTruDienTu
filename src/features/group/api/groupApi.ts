import { mapAdminGroupListItem, mapAdminGroupToGroup } from '../lib/mapAdminGroup'
import type {
  AdminGroupsListParamsT,
  AdminGroupsQueryDataT,
  Group,
  UpdateAdminGroupPayloadT,
} from '../types'
import {
  deleteAdminGroup,
  getAdminGroupById,
  getAdminGroups,
  updateAdminGroup,
} from './groupClient'
export const groupApi = {
  getGroups: async (
    params: AdminGroupsListParamsT = {},
  ): Promise<AdminGroupsQueryDataT> => {
    const { items, projects = [], page, limit, total, totalPages } =
      await getAdminGroups(params)
    return {
      groups: items.map(mapAdminGroupListItem),
      projects,
      page,
      limit,
      total,
      totalPages,
    }
  },

  getGroupById: async (id: string): Promise<Group> => {
    const record = await getAdminGroupById(id)
    return mapAdminGroupToGroup(record)
  },

  updateGroup: async (
    id: string,
    payload: UpdateAdminGroupPayloadT,
  ): Promise<Group> => {
    const updated = await updateAdminGroup(id, payload)
    return mapAdminGroupToGroup(updated)
  },

  deleteGroup: async (id: string): Promise<void> => {
    await deleteAdminGroup(id)
  },
}
