import type { Group } from '../types'
import type { UpdateAdminGroupPayloadT } from '../types'
import { deleteAdminGroup, getAdminGroups, updateAdminGroup } from './groupClient'
import { mapAdminGroupToGroup } from '../lib/mapAdminGroup'

export const groupApi = {
  getGroups: async (): Promise<Array<Group>> => {
    const { items } = await getAdminGroups()
    return items.map(mapAdminGroupToGroup)
  },

  updateGroup: async (id: string, payload: UpdateAdminGroupPayloadT): Promise<Group> => {
    const updated = await updateAdminGroup(id, payload)
    return mapAdminGroupToGroup(updated)
  },

  deleteGroup: async (id: string): Promise<void> => {
    await deleteAdminGroup(id)
  },
}
