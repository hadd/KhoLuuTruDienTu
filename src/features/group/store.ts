import { useStore } from '@tanstack/react-store'
import { Store } from '@tanstack/store'

import {
  createInitialGroupConfigState,
} from '@/features/group/lib/groupConfigMockData'
import {
  getTemplateById,
  mergeMembersByLevelId,
} from '@/features/group/lib/groupConfigHelpers'
import type {
  GroupConfigInstanceT,
  GroupConfigTemplateT,
  GroupZoneMemberT,
} from '@/features/group/types'

export interface GroupConfigStateT {
  templates: Array<GroupConfigTemplateT>
  configByGroupId: Record<string, GroupConfigInstanceT>
}

const groupConfigStoreInstance = new Store<GroupConfigStateT>(
  createInitialGroupConfigState(),
)

export const groupConfigStore = {
  subscribe: groupConfigStoreInstance.subscribe,
  getState: () => groupConfigStoreInstance.state,

  setGroupTemplate: (groupId: string, templateId: string) => {
    const state = groupConfigStoreInstance.state
    const template = getTemplateById(state.templates, templateId)
    if (!template) return

    const existing = state.configByGroupId[groupId]
    const membersByLevelId = mergeMembersByLevelId(
      template,
      existing?.membersByLevelId,
    )

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          groupId,
          templateId,
          membersByLevelId,
        },
      },
    })
  },

  addZoneMember: (
    groupId: string,
    levelId: string,
    member: GroupZoneMemberT,
  ) => {
    const state = groupConfigStoreInstance.state
    const config = state.configByGroupId[groupId]
    if (!config) return

    const currentMembers = config.membersByLevelId[levelId] ?? []
    if (currentMembers.some((m) => m.userId === member.userId)) return

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...config,
          membersByLevelId: {
            ...config.membersByLevelId,
            [levelId]: [...currentMembers, member],
          },
        },
      },
    })
  },

  removeZoneMember: (groupId: string, levelId: string, userId: string) => {
    const state = groupConfigStoreInstance.state
    const config = state.configByGroupId[groupId]
    if (!config) return

    const currentMembers = config.membersByLevelId[levelId] ?? []

    groupConfigStoreInstance.setState({
      ...state,
      configByGroupId: {
        ...state.configByGroupId,
        [groupId]: {
          ...config,
          membersByLevelId: {
            ...config.membersByLevelId,
            [levelId]: currentMembers.filter((m) => m.userId !== userId),
          },
        },
      },
    })
  },
}

export const useGroupConfigStore = <T>(selector: (state: GroupConfigStateT) => T) =>
  useStore(groupConfigStoreInstance, selector)

export function useGroupConfig(groupId: string) {
  const templates = useGroupConfigStore((s) => s.templates)
  const config = useGroupConfigStore((s) => s.configByGroupId[groupId])
  const templateId = config?.templateId ?? 'default'
  const template =
    templates.find((t) => t.id === templateId) ??
    templates.find((t) => t.isDefault) ??
    templates[0]
  const membersByLevelId = config?.membersByLevelId ?? {}

  return {
    templates,
    templateId,
    template,
    membersByLevelId,
    isDefaultTemplate: Boolean(template?.isDefault),
  }
}
