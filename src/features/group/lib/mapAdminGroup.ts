import type { AdminGroupEditorT, AdminGroupLeaderT, AdminGroupQcT, AdminGroupT } from '@/features/group/types'
import type { Group, Member } from '@/features/group/types'

function mapEditorToMember(editor: AdminGroupEditorT): Member {
  return {
    id: editor.memberId,
    userId: editor.userId,
    name: editor.fullName,
    email: editor.email,
    role: 'member',
    joinedAt: '',
    documents: [],
  }
}

function mapLeaderToMember(leader: AdminGroupLeaderT): Member {
  return {
    id: leader.memberId,
    userId: leader.userId,
    name: leader.fullName,
    email: leader.email,
    role: 'leader',
    joinedAt: '',
    documents: [],
  }
}

function mapQcToMember(qc: AdminGroupQcT): Member {
  return {
    id: qc.memberId,
    userId: qc.userId,
    name: qc.fullName,
    email: qc.email,
    role: 'manager',
    joinedAt: '',
    documents: [],
  }
}

export function mapAdminGroupToGroup(adminGroup: AdminGroupT): Group {
  const members: Array<Member> = []
  const editorUserIds: Array<string> = []
  const qcUserIds: Array<string> = []

  if (adminGroup.leader) {
    members.push(mapLeaderToMember(adminGroup.leader))
  }

  for (const qc of adminGroup.qcs ?? []) {
    qcUserIds.push(qc.userId)
    members.push(mapQcToMember(qc))
  }

  for (const editor of adminGroup.editors) {
    editorUserIds.push(editor.userId)
    members.push(mapEditorToMember(editor))
  }

  return {
    id: adminGroup.id,
    name: adminGroup.name,
    description: adminGroup.description ?? '',
    memberCount: members.length,
    members,
    editorUserIds,
    qcUserIds,
    createdAt: adminGroup.createdAt,
    roundNumber: adminGroup.roundNumber,
  }
}
