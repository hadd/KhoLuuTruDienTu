import type { ProjectT } from '@/features/project-manager/types'

function pickString(
  source: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): string | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function pickManagerName(source: Record<string, unknown>): string | null {
  const direct = pickString(source, ['managerName', 'manager_name'])
  if (direct) return direct

  const manager = source.manager
  if (manager && typeof manager === 'object' && 'fullName' in manager) {
    const fullName = (manager as { fullName?: unknown }).fullName
    if (typeof fullName === 'string' && fullName.trim()) {
      return fullName.trim()
    }
  }

  return null
}

function pickManagerId(source: Record<string, unknown>): string | null {
  const direct = pickString(source, ['managerId', 'manager_id'])
  if (direct) return direct

  const manager = source.manager
  if (manager && typeof manager === 'object' && 'id' in manager) {
    const managerId = (manager as { id?: unknown }).id
    if (typeof managerId === 'string' && managerId.trim()) {
      return managerId.trim()
    }
  }

  return null
}

export function normalizeProjectFromApi(raw: unknown): ProjectT {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid project payload')
  }

  const record = raw as Record<string, unknown>

  return {
    projectCode: String(record.projectCode ?? record.project_code ?? ''),
    projectName: String(record.projectName ?? record.project_name ?? ''),
    projectType: String(record.projectType ?? record.project_type ?? ''),
    investor: String(record.investor ?? ''),
    startDate: pickString(record, ['startDate', 'start_date']),
    acceptanceDate: pickString(record, [
      'acceptanceDate',
      'acceptance_date',
      'endDate',
      'end_date',
    ]),
    totalInvestment: pickString(record, [
      'totalInvestment',
      'total_investment',
    ]),
    status: String(record.status ?? 'IN_PROGRESS'),
    managerId: pickManagerId(record),
    managerName: pickManagerName(record),
    createdAt: String(record.createdAt ?? record.created_at ?? ''),
    updatedAt: String(record.updatedAt ?? record.updated_at ?? ''),
    deletedAt: pickString(record, ['deletedAt', 'deleted_at']),
  }
}

export function formatProjectManagerName(project: ProjectT): string {
  return project.managerName?.trim() || '—'
}

export function getProjectFormKey(project: ProjectT): string {
  return [
    project.projectCode,
    project.startDate ?? '',
    project.acceptanceDate ?? '',
    project.totalInvestment ?? '',
    project.managerId ?? '',
    project.updatedAt ?? '',
  ].join('|')
}

export function mergeProjectData(
  primary: ProjectT | null | undefined,
  fallback: ProjectT | null | undefined,
): ProjectT | null {
  if (!primary && !fallback) return null
  if (!primary) return fallback ?? null
  if (!fallback) return primary

  return {
    ...primary,
    startDate: primary.startDate ?? fallback.startDate,
    acceptanceDate: primary.acceptanceDate ?? fallback.acceptanceDate,
    totalInvestment: primary.totalInvestment ?? fallback.totalInvestment,
    managerId: primary.managerId ?? fallback.managerId,
    managerName: primary.managerName ?? fallback.managerName,
  }
}
