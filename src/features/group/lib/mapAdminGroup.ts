import type {
  AdminGroupEditorT,
  AdminGroupLeaderT,
  AdminGroupQcLevelT,
  AdminGroupQcT,
  AdminGroupT,
  Group,
  GroupQcLevelT,
  Member,
} from '@/features/group/types'
import { normalizeQcLevels } from '@/features/group/lib/qcLevels'

function mapEditorToMember(
  editor: AdminGroupEditorT,
  permissionSlotCode: string | null = null,
): Member {
  return {
    id: editor.memberId,
    userId: editor.userId,
    name: editor.fullName,
    email: editor.email,
    role: 'member',
    joinedAt: '',
    documents: [],
    permissionSlotCode,
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

function mapQcLevel(level: AdminGroupQcLevelT): GroupQcLevelT {
  return {
    level: level.level,
    role: `Duyệt ${level.level}`,
    members: level.members.map((qcMember) => ({
      memberId: qcMember.memberId,
      userId: qcMember.userId,
      name: qcMember.fullName,
      email: qcMember.email,
    })),
  }
}

function buildFallbackQcLevels(adminGroup: AdminGroupT): Array<GroupQcLevelT> {
  const levels: Array<GroupQcLevelT> = []

  if (adminGroup.leader) {
    levels.push({
      level: 1,
      role: 'Duyệt 1',
      members: [
        {
          memberId: adminGroup.leader.memberId,
          userId: adminGroup.leader.userId,
          name: adminGroup.leader.fullName,
          email: adminGroup.leader.email,
        },
      ],
    })
  }

  for (const [index, qc] of (adminGroup.qcs ?? []).entries()) {
    const levelNumber = adminGroup.leader ? index + 2 : index + 1

    levels.push({
      level: levelNumber,
      role: `Duyệt ${levelNumber}`,
      members: [
        {
          memberId: qc.memberId,
          userId: qc.userId,
          name: qc.fullName,
          email: qc.email,
        },
      ],
    })
  }

  if (levels.length > 0) return levels

  const roundCount = adminGroup.roundNumber ?? 0
  for (let level = 1; level <= roundCount; level += 1) {
    levels.push({
      level,
      role: `Duyệt ${level}`,
      members: [],
    })
  }

  return levels
}

export function mapAdminGroupToGroup(adminGroup: AdminGroupT): Group {
  const members: Array<Member> = []
  const editorUserIds: Array<string> = []
  const qcUserIds: Array<string> = []

  const slotCodeByUserId = new Map<string, string | null>()
  for (const groupMember of adminGroup.groupMembers ?? []) {
    if (groupMember.role === 'editor') {
      slotCodeByUserId.set(groupMember.userId, groupMember.permissionSlotCode)
    }
  }

  if (adminGroup.leader) {
    members.push(mapLeaderToMember(adminGroup.leader))
  }

  for (const qc of adminGroup.qcs ?? []) {
    qcUserIds.push(qc.userId)
    members.push(mapQcToMember(qc))
  }

  for (const editor of adminGroup.editors) {
    editorUserIds.push(editor.userId)
    members.push(
      mapEditorToMember(editor, slotCodeByUserId.get(editor.userId) ?? null),
    )
  }

  const rawQcLevels =
    adminGroup.qcLevels && adminGroup.qcLevels.length > 0
      ? adminGroup.qcLevels.map(mapQcLevel)
      : buildFallbackQcLevels(adminGroup)

  const qcLevels = normalizeQcLevels(rawQcLevels, adminGroup.roundNumber)

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
    dossiersPerEditor: adminGroup.dossiersPerEditor ?? null,
    metadataPermissionConfigId: adminGroup.metadataPermissionConfigId ?? null,
    qcLevels,
  }
}
