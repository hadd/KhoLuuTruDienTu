import type { Group } from '../types'
import type { UpdateAdminGroupPayloadT } from '../types'
import { deleteAdminGroup, getAdminGroups, updateAdminGroup } from './groupClient'
import { mapAdminGroupToGroup } from '../lib/mapAdminGroup'

export const groupApi = {
  getGroups: async (): Promise<Array<Group>> => {
    const { items } = await getAdminGroups()
    return items.map(mapAdminGroupToGroup)
  },

  getGroupById: async (id: string): Promise<Group | undefined> => {
    const { items } = await getAdminGroups()
    const adminGroup = items.find((group) => group.id === id)
    return adminGroup ? mapAdminGroupToGroup(adminGroup) : undefined
  },

  updateGroup: async (id: string, payload: UpdateAdminGroupPayloadT): Promise<Group> => {
    const updated = await updateAdminGroup(id, payload)
    return mapAdminGroupToGroup(updated)
  },

  deleteGroup: async (id: string): Promise<void> => {
    await deleteAdminGroup(id)
  },
}
