import type { UserT } from '@/features/auth/types'
import type { AvailableEditorT, Group } from '@/features/group/types'

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

export function mapAvailableEditorToUser(editor: AvailableEditorT): UserT {
  return {
    id: editor.userId,
    email: editor.email,
    fullName: editor.fullName,
    ...EMPTY_USER_FIELDS,
  }
}

function mapMemberToUser(member: Group['members'][number]): UserT {
  return {
    id: member.userId,
    email: member.email,
    fullName: member.name,
    ...EMPTY_USER_FIELDS,
  }
}

/** Gộp editor khả dụng + editor đang có trong nhóm để có thể bỏ chọn/xóa. */
export function buildEditorUsersList(
  availableItems: Array<AvailableEditorT>,
  group: Group | null,
): Array<UserT> {
  const byId = new Map<string, UserT>()

  for (const item of availableItems) {
    byId.set(item.userId, mapAvailableEditorToUser(item))
  }

  if (group) {
    for (const member of group.members) {
      if (member.role === 'member' && !byId.has(member.userId)) {
        byId.set(member.userId, mapMemberToUser(member))
      }
    }
  }

  return Array.from(byId.values())
}

/** Editor chưa thuộc nhóm — dùng cho dialog thêm thành viên. */
export function buildAvailableEditorsNotInGroup(
  availableItems: Array<AvailableEditorT>,
  group: Group | null,
): Array<UserT> {
  const existingIds = new Set(group?.editorUserIds ?? [])
  return availableItems
    .filter((item) => !existingIds.has(item.userId))
    .map(mapAvailableEditorToUser)
}

/** Gộp user QC + Admin (dedupe theo id), kèm người duyệt đang có trong nhóm. */
export function buildQcAndAdminUsersList(
  qcUsers: Array<UserT>,
  adminUsers: Array<UserT>,
  group: Group | null,
): Array<UserT> {
  const merged = new Map<string, UserT>()
  for (const user of [...qcUsers, ...adminUsers]) {
    merged.set(user.id, user)
  }
  return buildQcUsersList(Array.from(merged.values()), group)
}

export function buildQcUsersList(
  qcUsers: Array<UserT>,
  group: Group | null,
): Array<UserT> {
  const byId = new Map<string, UserT>(qcUsers.map((user) => [user.id, user]))

  if (group) {
    for (const level of group.qcLevels) {
      for (const member of level.members) {
        if (!byId.has(member.userId)) {
          byId.set(member.userId, {
            id: member.userId,
            email: member.email,
            fullName: member.name,
            ...EMPTY_USER_FIELDS,
          })
        }
      }
    }

    const leader = group.members.find((member) => member.role === 'leader')
    if (leader && !byId.has(leader.userId)) {
      byId.set(leader.userId, mapMemberToUser(leader))
    }
  }

  return Array.from(byId.values())
}
