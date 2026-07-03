import { mapAdminGroupToGroup } from '../lib/mapAdminGroup'
import type { AdminGroupsQueryDataT, Group, UpdateAdminGroupPayloadT } from '../types'
import {
  deleteAdminGroup,
  getAdminGroups,
  updateAdminGroup,
} from './groupClient'

export const groupApi = {
  getGroups: async (): Promise<AdminGroupsQueryDataT> => {
    const { items, projects = [] } = await getAdminGroups()
    return {
      groups: items.map(mapAdminGroupToGroup),
      projects,
    }
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
