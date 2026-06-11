import type {
  GroupConfigInstanceT,
  GroupConfigLevelT,
  GroupConfigLevelTypeT,
  GroupConfigTemplateT,
  GroupZoneMemberT,
} from '../types'

export function getTemplateById(
  templates: Array<GroupConfigTemplateT>,
  templateId: string,
): GroupConfigTemplateT | undefined {
  return templates.find((t) => t.id === templateId)
}

export function getDefaultTemplate(
  templates: Array<GroupConfigTemplateT>,
): GroupConfigTemplateT {
  return templates.find((t) => t.isDefault) ?? templates[0]
}

export function filterLevelsByType(
  levels: Array<GroupConfigLevelT>,
  type: GroupConfigLevelTypeT,
): Array<GroupConfigLevelT> {
  return levels.filter((level) => level.type === type).sort((a, b) => a.order - b.order)
}

export function createEmptyMembersByLevelId(
  template: GroupConfigTemplateT,
): Record<string, Array<GroupZoneMemberT>> {
  return Object.fromEntries(template.levels.map((level) => [level.id, []]))
}

export function mergeMembersByLevelId(
  template: GroupConfigTemplateT,
  existing?: Record<string, Array<GroupZoneMemberT>>,
): Record<string, Array<GroupZoneMemberT>> {
  const empty = createEmptyMembersByLevelId(template)
  if (!existing) return empty

  return Object.fromEntries(
    template.levels.map((level) => [level.id, existing[level.id] ?? []]),
  )
}

export function getGroupConfigInstance(
  configByGroupId: Record<string, GroupConfigInstanceT>,
  groupId: string,
  templates: Array<GroupConfigTemplateT>,
): GroupConfigInstanceT {
  const existing = configByGroupId[groupId]
  if (existing) return existing

  const defaultTemplate = getDefaultTemplate(templates)
  return {
    groupId,
    templateId: defaultTemplate.id,
    membersByLevelId: createEmptyMembersByLevelId(defaultTemplate),
  }
}

export function mapUserToZoneMember(user: {
  id: string
  fullName: string
  email: string
}): GroupZoneMemberT {
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
  }
}
