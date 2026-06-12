import type {
  CreateAdminGroupQcLevelPayloadT,
  UpdateAdminGroupPayloadT,
} from '@/features/group/types'
import type { Group } from '@/features/group/types'

export const MAX_APPROVAL_LEVELS = 5

export function getLeaderUserIdFromGroup(group: Group): string {
  return group.members.find((member) => member.role === 'leader')?.userId ?? ''
}

export function getQcLevelUserIdsFromGroup(group: Group): Array<Array<string>> {
  return [...group.qcLevels]
    .sort((a, b) => a.level - b.level)
    .map((level) => level.members.map((member) => member.userId))
}

export function buildUpdateGroupPayload(
  group: Group,
  overrides: Partial<UpdateAdminGroupPayloadT> = {},
): UpdateAdminGroupPayloadT {
  const qcLevels: Array<CreateAdminGroupQcLevelPayloadT> =
    overrides.qcLevels ??
    getQcLevelUserIdsFromGroup(group).map((userIds) => ({ userIds }))

  const roundNumber =
    overrides.roundNumber ?? (qcLevels.length > 0 ? qcLevels.length : 0)
  const usesLeaderOnly = roundNumber === 0

  const payload: UpdateAdminGroupPayloadT = {
    name: overrides.name ?? group.name,
    description: overrides.description ?? group.description,
    roundNumber,
    editorIds: overrides.editorIds ?? group.editorUserIds,
    qcLevels: usesLeaderOnly ? [] : qcLevels,
  }

  if (usesLeaderOnly) {
    const leaderId = overrides.leaderId ?? getLeaderUserIdFromGroup(group)
    if (leaderId) {
      payload.leaderId = leaderId
    }
  }

  return payload
}
