import { ARCHIVE_DISPOSAL_PERMISSIONS } from '@/features/archive-disposal/lib/archiveDisposalAccess'
import type { UserT } from '@/features/auth/types'
import type { DisposalCouncilMemberInputT, DisposalCouncilMemberT } from '@/features/archive-disposal-council/types'
import { DISPOSAL_COUNCIL_PERMISSIONS } from '@/features/archive-disposal-council/lib/disposalCouncilAccess'
import { getUsersByPermission } from '@/features/user/api/userClient'

export const DISPOSAL_COUNCIL_MEMBER_ELIGIBLE_PERMISSIONS = [
  ARCHIVE_DISPOSAL_PERMISSIONS.read,
  DISPOSAL_COUNCIL_PERMISSIONS.councilRead,
  DISPOSAL_COUNCIL_PERMISSIONS.settingsRead,
] as const

function userStubFromCouncilMember(member: DisposalCouncilMemberT): UserT {
  return {
    id: member.userId,
    email: member.email,
    fullName: member.fullName,
    avatarUrl: null,
    dateOfBirth: null,
    gender: null,
    phone: null,
    address: null,
    lastLoginAt: '',
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  }
}

/**
 * Users present in every permission list (AND across permissions).
 */
export function intersectUsersByPermissionLists(
  lists: Array<Array<UserT>>,
): Array<UserT> {
  if (lists.length === 0) return []
  const [first, ...rest] = lists
  if (!first?.length) return []

  const userById = new Map(first.map((user) => [user.id, user]))
  for (const list of rest) {
    const ids = new Set(list.map((user) => user.id))
    for (const id of userById.keys()) {
      if (!ids.has(id)) userById.delete(id)
    }
  }

  return Array.from(userById.values()).sort((left, right) =>
    left.fullName.localeCompare(right.fullName, 'vi'),
  )
}

export async function getDisposalCouncilEligibleUsers(): Promise<Array<UserT>> {
  const responses = await Promise.all(
    DISPOSAL_COUNCIL_MEMBER_ELIGIBLE_PERMISSIONS.map((permission) =>
      getUsersByPermission(permission),
    ),
  )
  return intersectUsersByPermissionLists(responses.map((response) => response.items))
}

export function mergeCouncilPickerUsers(
  eligibleUsers: Array<UserT>,
  memberDrafts: Array<DisposalCouncilMemberInputT>,
  councilMembers?: Array<DisposalCouncilMemberT>,
): Array<UserT> {
  const byId = new Map(eligibleUsers.map((user) => [user.id, user]))

  for (const draft of memberDrafts) {
    if (!draft.userId || byId.has(draft.userId)) continue
    const member = councilMembers?.find((m) => m.userId === draft.userId)
    if (member) {
      byId.set(draft.userId, userStubFromCouncilMember(member))
    }
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.fullName.localeCompare(right.fullName, 'vi'),
  )
}
