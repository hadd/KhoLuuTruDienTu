import type { UserT } from '@/features/auth/types'
import type { Group, GroupQcLevelT } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'

const EMPTY_USER_FIELDS = {
  avatarUrl: null,
  dateOfBirth: null,
  gender: null,
  phone: null,
  address: null,
  lastLoginAt: '',
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
} as const

/** Chuyển mảng userIds theo cấp thành GroupQcLevelT để hiển thị UI. */
export function buildQcLevelsDisplay(
  levelUserIds: Array<Array<string>>,
  group: Group | null,
  approverUsers: Array<UserT>,
): Array<GroupQcLevelT> {
  const userById = new Map<string, UserT>(
    approverUsers.map((user) => [user.id, user]),
  )

  if (group) {
    for (const level of group.qcLevels) {
      for (const member of level.members) {
        if (!userById.has(member.userId)) {
          userById.set(member.userId, {
            id: member.userId,
            email: member.email,
            fullName: member.name,
            ...EMPTY_USER_FIELDS,
          })
        }
      }
    }
  }

  return levelUserIds.map((userIds, index) => ({
    level: index + 1,
    role: `Duyệt ${index + 1}`,
    members: userIds.map((userId) => {
      const user = userById.get(userId)
      const fromGroup = group?.qcLevels
        .flatMap((level) => level.members)
        .find((member) => member.userId === userId)

      return {
        memberId: fromGroup?.memberId ?? userId,
        userId,
        name: user?.fullName ?? fromGroup?.name ?? userId,
        email: user?.email ?? fromGroup?.email ?? '',
      }
    }),
  }))
}

/** Pad or preserve QC levels so UI always reflects roundNumber (and never drops existing levels). */
export function normalizeQcLevels(
  levels: Array<GroupQcLevelT>,
  roundNumber: number | undefined,
): Array<GroupQcLevelT> {
  const levelByNumber = new Map(levels.map((level) => [level.level, level]))
  const maxExistingLevel = levels.reduce(
    (max, level) => Math.max(max, level.level),
    0,
  )
  const targetCount = Math.max(
    roundNumber ?? 0,
    maxExistingLevel,
    levels.length,
  )

  if (targetCount === 0) return []

  const result: Array<GroupQcLevelT> = []

  for (let level = 1; level <= targetCount; level += 1) {
    const existing = levelByNumber.get(level)
    result.push(
      existing ?? {
        level,
        role: `Duyệt ${level}`,
        members: [],
      },
    )
  }

  return result
}

/** Responsive grid columns for editor / approver level cards. */
export function getLevelGridClass(count: number) {
  return cn(
    'grid gap-3',
    count >= 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : count >= 3
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : count > 1
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1',
  )
}
