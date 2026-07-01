import { ASSIGN_FOLDER_ROLE } from '@/features/data-management/lib/constants'
import { getCheckerLevelForDossierStatus } from '@/features/data-management/lib/dossierStatusHelpers'
import type {
  DataAssigneeT,
  DataCheckerAssignmentT,
  DataCheckerRoleT,
  DataDossierStatus,
  DataTreeNodeT,
} from '@/features/data-management/types'
import { buildCheckerAssignmentsFromGroup } from '@/features/group/lib/buildCheckerAssignmentsFromGroup'
import type { Group } from '@/features/group/types'

const CHECKER_ROLE_PATTERN = /^CHECKER_([1-5])$/i

function toCheckerRole(level: number): DataCheckerRoleT {
  return `CHECKER_${level}` as DataCheckerRoleT
}

function parseCheckerLevelFromRole(role: string): number | null {
  const match = CHECKER_ROLE_PATTERN.exec(role.trim())
  if (!match?.[1]) return null
  const level = Number(match[1])
  return level >= 1 && level <= 5 ? level : null
}

function extractAssigneeFromRecord(
  record: Record<string, unknown>,
): DataAssigneeT | null {
  const user =
    record.user ??
    record.assignee ??
    record.userProfile ??
    record.assigneeProfile

  const nested =
    user && typeof user === 'object'
      ? (user as Record<string, unknown>)
      : record

  const id =
    nested.userId ??
    nested.id ??
    record.assigneeId ??
    record.userId ??
    record.user_id

  if (id == null) return null

  const name =
    nested.fullName ??
    nested.full_name ??
    nested.name ??
    nested.email ??
    String(id)

  const roleValue = String(record.role ?? '').toUpperCase()
  const assigneeRole: DataAssigneeT['role'] =
    roleValue === 'MAKER' ? 'editor' : 'reviewer'

  return {
    id: String(id),
    name: String(name),
    role: assigneeRole,
  }
}

function collectAssignmentRecords(
  source: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const buckets: Array<unknown> = [
    source.assignments,
    source.checkerAssignments,
    source.checker_assignments,
    source.dossierAssignments,
    source.dossier_assignments,
  ]

  const records: Array<Record<string, unknown>> = []

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const item of bucket) {
      if (item && typeof item === 'object') {
        records.push(item as Record<string, unknown>)
      }
    }
  }

  const maker =
    source.makerAssignment ??
    source.maker_assignment ??
    source.editorAssignment ??
    source.editor_assignment

  if (maker && typeof maker === 'object') {
    records.push(maker as Record<string, unknown>)
  }

  return records
}

export function parseCheckerAssignmentsFromDossierPayload(
  source: Record<string, unknown>,
): {
  checkerAssignments: Array<DataCheckerAssignmentT>
  editor?: DataAssigneeT
} {
  const byLevel = new Map<number, Map<string, DataAssigneeT>>()
  let editor: DataAssigneeT | undefined

  for (const record of collectAssignmentRecords(source)) {
    const role = String(
      record.role ?? record.assignmentRole ?? '',
    ).toUpperCase()
    const assignee = extractAssigneeFromRecord(record)
    if (!assignee) continue

    if (role === ASSIGN_FOLDER_ROLE.maker) {
      editor = assignee
      continue
    }

    const level = parseCheckerLevelFromRole(role)
    if (level == null) continue

    const levelMap = byLevel.get(level) ?? new Map<string, DataAssigneeT>()
    levelMap.set(assignee.id, { ...assignee, role: 'reviewer' })
    byLevel.set(level, levelMap)
  }

  const checkerAssignments = [...byLevel.entries()]
    .sort(([left], [right]) => left - right)
    .map(([level, assigneeMap]) => ({
      level,
      role: toCheckerRole(level),
      assignees: [...assigneeMap.values()],
    }))

  return { checkerAssignments, editor }
}

export function applyLegacyReviewersFromCheckerAssignments(
  node: DataTreeNodeT,
  checkerAssignments: Array<DataCheckerAssignmentT>,
): void {
  const byLevel = (level: number) =>
    checkerAssignments.find((item) => item.level === level)?.assignees[0]

  const reviewer1 = byLevel(1)
  const reviewer2 = byLevel(2)
  const reviewer3 = byLevel(3)

  if (reviewer1) node.reviewer1 = reviewer1
  if (reviewer2) node.reviewer2 = reviewer2
  if (reviewer3) node.reviewer3 = reviewer3
}

export function applyCheckerAssignmentsToNode(
  node: DataTreeNodeT,
  source: Record<string, unknown>,
): void {
  const { checkerAssignments, editor } =
    parseCheckerAssignmentsFromDossierPayload(source)

  if (checkerAssignments.length > 0) {
    node.checkerAssignments = checkerAssignments
    applyLegacyReviewersFromCheckerAssignments(node, checkerAssignments)
  }

  if (editor) {
    node.editor = editor
  }
}

export function getActiveCheckerLevel(
  dossierStatus: DataDossierStatus | undefined,
): number | null {
  return getCheckerLevelForDossierStatus(dossierStatus)
}

export function buildLevelUserIdsFromGroup(
  group: Group,
): Record<number, Array<string>> {
  const result: Record<number, Array<string>> = {}
  for (const level of buildCheckerAssignmentsFromGroup(group)) {
    result[level.level] = [...level.userIds]
  }
  return result
}
