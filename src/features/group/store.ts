import { useStore } from '@tanstack/react-store'
import { Store } from '@tanstack/store'

import type {
  GroupConfigInstanceT,
  GroupZoneMemberT,
} from '@/features/group/types'

export interface GroupConfigStateT {
  configByGroupId: Record<string, GroupConfigInstanceT>
}

function createEmptyGroupConfig(groupId: string): GroupConfigInstanceT {
  return {
    groupId,
    slotAssignmentsBySlotCode: {},
  }
}

const groupConfigStoreInstance = new Store<GroupConfigStateT>({
  configByGroupId: {},
})

export const groupConfigStore = {
  subscribe: groupConfigStoreInstance.subscribe,
  getState: () => groupConfigStoreInstance.state,

  setGroupMetadataPermissionMode: (groupId: string, enabled: boolean) => {
    const state = groupConfigStoreInstance.state
    const existing =
      state.configByGroupId[groupId] ?? createEmptyGroupConfig(groupId)

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...existing,
          useMetadataPermissionConfig: enabled,
          metadataTemplateId: enabled ? existing.metadataTemplateId : undefined,
          metadataPermissionConfigId: enabled
            ? existing.metadataPermissionConfigId
            : undefined,
          slotAssignmentsBySlotCode: enabled
            ? existing.slotAssignmentsBySlotCode
            : {},
        },
      },
    })
  },

  setGroupMetadataTemplate: (groupId: string, metadataTemplateId: string) => {
    const state = groupConfigStoreInstance.state
    const existing = state.configByGroupId[groupId]
    if (!existing?.useMetadataPermissionConfig) return

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...existing,
          metadataTemplateId,
          metadataPermissionConfigId: undefined,
          slotAssignmentsBySlotCode: {},
        },
      },
    })
  },

  setGroupMetadataPermissionConfig: (
    groupId: string,
    metadataPermissionConfigId: string,
  ) => {
    const state = groupConfigStoreInstance.state
    const existing = state.configByGroupId[groupId]
    if (!existing?.useMetadataPermissionConfig) return

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...existing,
          metadataPermissionConfigId,
          slotAssignmentsBySlotCode: {},
        },
      },
    })
  },

  addSlotMember: (
    groupId: string,
    slotCode: string,
    member: GroupZoneMemberT,
  ) => {
    const state = groupConfigStoreInstance.state
    const config = state.configByGroupId[groupId]
    if (!config) return

    const currentMembers = config.slotAssignmentsBySlotCode[slotCode] ?? []
    if (currentMembers.some((item) => item.userId === member.userId)) return

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...config,
          slotAssignmentsBySlotCode: {
            ...config.slotAssignmentsBySlotCode,
            [slotCode]: [...currentMembers, member],
          },
        },
      },
    })
  },

  removeSlotMember: (groupId: string, slotCode: string, userId: string) => {
    const state = groupConfigStoreInstance.state
    const config = state.configByGroupId[groupId]
    if (!config) return

    const currentMembers = config.slotAssignmentsBySlotCode[slotCode] ?? []

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...config,
          slotAssignmentsBySlotCode: {
            ...config.slotAssignmentsBySlotCode,
            [slotCode]: currentMembers.filter(
              (member) => member.userId !== userId,
            ),
          },
        },
      },
    })
  },

  initSlotAssignments: (
    groupId: string,
    slotAssignmentsBySlotCode: Record<string, Array<GroupZoneMemberT>>,
  ) => {
    const state = groupConfigStoreInstance.state
    const existing =
      state.configByGroupId[groupId] ?? createEmptyGroupConfig(groupId)

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...existing,
          slotAssignmentsBySlotCode,
        },
      },
    })
  },

  initFromGroup: (
    groupId: string,
    params: {
      metadataPermissionConfigId?: string | null
      metadataTemplateId?: string
    },
  ) => {
    const state = groupConfigStoreInstance.state
    if (state.configByGroupId[groupId]) return

    const enabled = Boolean(params.metadataPermissionConfigId)

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          groupId,
          useMetadataPermissionConfig: enabled,
          metadataPermissionConfigId:
            params.metadataPermissionConfigId ?? undefined,
          metadataTemplateId: params.metadataTemplateId,
          slotAssignmentsBySlotCode: {},
        },
      },
    })
  },
}

export const useGroupConfigStore = <T>(
  selector: (state: GroupConfigStateT) => T,
) => useStore(groupConfigStoreInstance, selector)

export function useGroupConfig(groupId: string) {
  const config = useGroupConfigStore((state) => state.configByGroupId[groupId])

  return {
    useMetadataPermissionConfig: Boolean(config?.useMetadataPermissionConfig),
    metadataTemplateId: config?.metadataTemplateId,
    metadataPermissionConfigId: config?.metadataPermissionConfigId,
    slotAssignmentsBySlotCode: config?.slotAssignmentsBySlotCode ?? {},
  }
}
