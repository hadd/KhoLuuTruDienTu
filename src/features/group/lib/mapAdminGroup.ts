import type { AdminGroupMemberT, AdminGroupT } from '@/features/group/types'
import type { Group, Member } from '@/features/group/types'

function mapMemberRole(apiRole: string): Member['role'] {
  switch (apiRole) {
    case 'leader':
      return 'leader'
    case 'manager':
      return 'manager'
    default:
      return 'member'
  }
}

function mapGroupMember(member: AdminGroupMemberT): Member {
  const joinedAt = member.createdAt.includes('T')
    ? member.createdAt.split('T')[0]
    : member.createdAt

  return {
    id: member.id,
    name: member.userProfile.fullName,
    email: member.userProfile.email,
    role: mapMemberRole(member.role),
    joinedAt,
    documents: [],
  }
}

export function mapAdminGroupToGroup(adminGroup: AdminGroupT): Group {
  const members = (adminGroup.groupMembers ?? []).map(mapGroupMember)

  return {
    id: adminGroup.id,
    name: adminGroup.name,
    description: adminGroup.description ?? '',
    memberCount: members.length,
    members,
    createdAt: adminGroup.createdAt,
    roundNumber: adminGroup.roundNumber,
  }
}
