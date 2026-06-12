import type {
  AdminGroupAssignmentT,
  AdminGroupEditorT,
  AdminGroupLeaderT,
  AdminGroupPermissionConfigSlotT,
  AdminGroupPermissionConfigT,
  AdminGroupQcLevelT,
  AdminGroupQcT,
  AdminGroupT,
  Group,
  GroupPermissionConfigSummaryT,
  GroupPermissionSlotT,
  GroupQcLevelT,
  GroupSlotAssignmentT,
  GroupZoneMemberT,
  Member,
} from '@/features/group/types'
import { normalizeQcLevels } from '@/features/group/lib/qcLevels'

function parseFieldKeys(fieldKeys: Array<string> | string): Array<string> {
  if (Array.isArray(fieldKeys)) return fieldKeys
  try {
    const parsed: unknown = JSON.parse(fieldKeys)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function mapPermissionConfigSlot(
  slot: AdminGroupPermissionConfigSlotT,
): GroupPermissionSlotT {
  return {
    slotCode: slot.slotCode,
    slotName: slot.slotName,
    sortOrder: slot.sortOrder,
    fieldKeys: parseFieldKeys(slot.fieldKeys),
  }
}

function mapPermissionConfig(
  config: AdminGroupPermissionConfigT | undefined,
): GroupPermissionConfigSummaryT | null {
  if (!config) return null

  return {
    id: config.id,
    name: config.name,
    templateId: config.templateId,
    template: config.template,
    slots: (config.slots ?? []).map(mapPermissionConfigSlot),
  }
}

function mapAssignments(
  assignments: Array<AdminGroupAssignmentT> | undefined,
): Array<GroupSlotAssignmentT> {
  return (assignments ?? []).map((assignment) => ({
    slotCode: assignment.slotCode,
    slotName: assignment.slotName,
    fieldKeys: assignment.fieldKeys,
    editors: assignment.editors,
  }))
}

export function buildSlotAssignmentsFromGroup(
  group: Pick<Group, 'assignments' | 'members'>,
): Record<string, Array<GroupZoneMemberT>> {
  const assignments: Record<string, Array<GroupZoneMemberT>> = {}

  for (const assignment of group.assignments ?? []) {
    assignments[assignment.slotCode] = assignment.editors.map((editor) => ({
      userId: editor.editorId,
      fullName: editor.fullName,
      email: editor.email,
    }))
  }

  if (Object.keys(assignments).length > 0) return assignments

  for (const member of group.members) {
    if (member.role !== 'member' || !member.permissionSlotCode) continue

    const slotCode = member.permissionSlotCode
    const current = assignments[slotCode] ?? []
    assignments[slotCode] = [
      ...current,
      {
        userId: member.userId,
        fullName: member.name,
        email: member.email,
      },
    ]
  }

  return assignments
}

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

  const permissionConfig =
    mapPermissionConfig(adminGroup.permissionConfig) ??
    mapPermissionConfig(adminGroup.metadataPermissionConfig)

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
    permissionConfig,
    assignments: mapAssignments(adminGroup.assignments),
    qcLevels,
  }
}
