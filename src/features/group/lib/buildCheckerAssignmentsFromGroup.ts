import type { Group } from '@/features/group/types'
import type { QcCheckerRoleT } from '@/features/qc-dashboard/types'

export interface GroupCheckerLevelT {
  level: number
  role: QcCheckerRoleT
  userIds: Array<string>
  members: Array<{ userId: string; name: string; email: string }>
}

export function buildCheckerAssignmentsFromGroup(
  group: Group,
): Array<GroupCheckerLevelT> {
  const roundNumber = group.roundNumber ?? 0
  if (roundNumber === 0) return []

  return [...group.qcLevels]
    .sort((left, right) => left.level - right.level)
    .slice(0, roundNumber)
    .map((level) => ({
      level: level.level,
      role: `CHECKER_${level.level}` as QcCheckerRoleT,
      userIds: level.members.map((member) => member.userId),
      members: level.members.map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email,
      })),
    }))
}
