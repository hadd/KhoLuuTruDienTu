import { getCheckerLevelForDossierStatus } from '@/features/data-management/lib/dossierStatusHelpers'
import type {
  DataDossierAssignmentItemT,
  DataDossierStatus,
  DataDossierWorkflowAssignmentsT,
  DataWorkflowStepPhaseT,
  DataWorkflowStepT,
} from '@/features/data-management/types'

const CHECKER_ROLE_PATTERN = /^CHECKER_([1-5])$/i

const ENTRY_STATUSES = new Set<string>([
  'READY_FOR_ENTRY',
  'ENTRY_PROCESSING',
  'ENTRY_DRAFT',
])

const APPROVED_OR_LATER = new Set<string>([
  'APPROVED',
  'PENDING_ARCHIVE',
  'ARCHIVE_REJECTED',
  'ARCHIVED',
])

function assigneeDisplayName(item: DataDossierAssignmentItemT): string {
  const name = item.assignee.fullName?.trim()
  if (name) return name
  const email = item.assignee.email?.trim()
  if (email) return email
  return item.assignee.id
}

function parseCheckerLevel(role: string): number | null {
  const match = CHECKER_ROLE_PATTERN.exec(role.trim())
  if (!match?.[1]) return null
  const level = Number(match[1])
  return level >= 1 && level <= 5 ? level : null
}

function groupAssigneesByRole(
  assignments: Array<DataDossierAssignmentItemT>,
): Map<string, Array<{ id: string; name: string; status: string }>> {
  const byRole = new Map<
    string,
    Map<string, { id: string; name: string; status: string }>
  >()

  for (const item of assignments) {
    const role = String(item.role).toUpperCase()
    const roleMap = byRole.get(role) ?? new Map()
    const existing = roleMap.get(item.assignee.id)
    // Prefer active/completed over older rejected rows for the same person.
    if (
      !existing ||
      item.status === 'IN_PROGRESS' ||
      item.status === 'DRAFT' ||
      item.status === 'COMPLETED'
    ) {
      roleMap.set(item.assignee.id, {
        id: item.assignee.id,
        name: assigneeDisplayName(item),
        status: String(item.status),
      })
    }
    byRole.set(role, roleMap)
  }

  const result = new Map<
    string,
    Array<{ id: string; name: string; status: string }>
  >()
  for (const [role, people] of byRole) {
    result.set(role, [...people.values()])
  }
  return result
}

function resolveMakerPhase(
  status: string,
  currentQcStep: number,
): DataWorkflowStepPhaseT {
  if (APPROVED_OR_LATER.has(status)) return 'completed'
  if (status.endsWith('_REJECTED')) return 'current'
  if (ENTRY_STATUSES.has(status) || status === 'WAITING_ISSUE_RESOLUTION') {
    return 'current'
  }
  if (
    status === 'NEW' ||
    status === 'OCR_PROCESSING' ||
    status === 'OCR_FAILED'
  ) {
    return 'pending'
  }
  // Maker already submitted; QC in progress or beyond
  if (
    currentQcStep > 0 ||
    getCheckerLevelForDossierStatus(status as DataDossierStatus) != null
  ) {
    return 'completed'
  }
  return 'pending'
}

function resolveCheckerPhase(
  level: number,
  status: string,
  currentQcStep: number,
): DataWorkflowStepPhaseT {
  if (APPROVED_OR_LATER.has(status)) return 'completed'
  if (currentQcStep >= level) return 'completed'

  const activeLevel = getCheckerLevelForDossierStatus(
    status as DataDossierStatus,
  )
  if (activeLevel === level) {
    if (status.endsWith('_REJECTED')) return 'rejected'
    return 'current'
  }

  return 'pending'
}

function resolveApprovedPhase(status: string): DataWorkflowStepPhaseT {
  if (APPROVED_OR_LATER.has(status)) return 'completed'
  return 'pending'
}

/** Build ordered workflow steps (Biên tập → Duyệt 1…N → Đã duyệt). */
export function buildWorkflowSteps(
  data: DataDossierWorkflowAssignmentsT,
): Array<DataWorkflowStepT> {
  const status = String(data.status)
  const requiredQcCount = Math.max(0, Math.min(5, data.requiredQcCount ?? 0))
  const currentQcStep = Math.max(0, data.currentQcStep ?? 0)
  const byRole = groupAssigneesByRole(data.assignments)

  const steps: Array<DataWorkflowStepT> = [
    {
      key: 'maker',
      kind: 'maker',
      role: 'MAKER',
      phase: resolveMakerPhase(status, currentQcStep),
      assignees: byRole.get('MAKER') ?? [],
    },
  ]

  for (let level = 1; level <= requiredQcCount; level++) {
    const role = `CHECKER_${level}`
    steps.push({
      key: role,
      kind: 'checker',
      level,
      totalCheckers: requiredQcCount,
      role,
      phase: resolveCheckerPhase(level, status, currentQcStep),
      assignees: byRole.get(role) ?? [],
    })
  }

  if (requiredQcCount === 0) {
    steps.push({
      key: 'approved',
      kind: 'approved',
      phase: resolveApprovedPhase(status),
      assignees: [],
    })
  }

  return steps
}

export function resolveCurrentStepLabel(
  steps: Array<DataWorkflowStepT>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const current = steps.find((step) => step.phase === 'current')
  if (!current) {
    const isFullyApproved = steps.length > 0 && steps[steps.length - 1].phase === 'completed'
    if (isFullyApproved) return t('recordDetail.workflow.currentApproved')
    return t('recordDetail.workflow.currentNone')
  }

  if (current.kind === 'maker') return t('recordDetail.workflow.stepMaker')
  if (current.kind === 'checker' && current.level != null) {
    if (current.totalCheckers === 1) {
      return t('recordDetail.workflow.stepCheckerSingle')
    }
    return t('recordDetail.workflow.stepChecker', { level: current.level })
  }
  return t('recordDetail.workflow.currentNone')
}

export function parseCheckerLevelFromRole(role: string): number | null {
  return parseCheckerLevel(role)
}
