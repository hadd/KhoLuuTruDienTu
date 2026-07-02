import { toDateInputValue } from '@/features/project-manager/lib/projectDate'
import type { ProjectFormValues } from '@/features/project-manager/schemas'
import type {
  CreateProjectPayloadT,
  ProjectT,
  UpdateProjectPayloadT,
} from '@/features/project-manager/types'

function normalizeInvestmentInput(value: string | null): string {
  if (!value) return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed
  }

  return trimmed
    .replace(/\.0+$/, '')
    .replace(/(\.\d*?[1-9])0+$/, '$1')
}

export function buildProjectPayload(
  value: ProjectFormValues,
): CreateProjectPayloadT {
  const managerId = value.managerId?.trim()

  return {
    projectCode: value.projectCode.trim(),
    projectName: value.projectName.trim(),
    projectType: value.projectType.trim(),
    investor: value.investor.trim(),
    acceptanceDate: value.acceptanceDate,
    status: value.status,
    ...(managerId ? { managerId } : {}),
    ...(value.startDate?.trim() ? { startDate: value.startDate.trim() } : {}),
    ...(value.totalInvestment?.trim()
      ? { totalInvestment: value.totalInvestment.trim() }
      : {}),
  }
}

export function projectToFormValues(project: ProjectT): ProjectFormValues {
  return {
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectType: project.projectType,
    investor: project.investor,
    startDate: toDateInputValue(project.startDate),
    acceptanceDate: toDateInputValue(project.acceptanceDate),
    changeReason: '',
    totalInvestment: normalizeInvestmentInput(project.totalInvestment),
    status: (project.status as ProjectFormValues['status']) || 'IN_PROGRESS',
    managerId: project.managerId ?? '',
  }
}

export function buildUpdateProjectPayload(
  value: ProjectFormValues,
  originalAcceptanceDate: string,
  originalManagerId: string,
): UpdateProjectPayloadT {
  const payload: UpdateProjectPayloadT = buildProjectPayload(value)
  const nextManagerId = value.managerId?.trim() ?? ''

  if (value.acceptanceDate.trim() !== originalAcceptanceDate.trim()) {
    payload.changeReason = value.changeReason?.trim() ?? ''
  }

  if (nextManagerId && nextManagerId !== originalManagerId.trim()) {
    payload.managerId = nextManagerId
  } else {
    delete payload.managerId
  }

  return payload
}
