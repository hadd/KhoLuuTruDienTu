import type { CreateProjectPayloadT, ProjectT } from '@/features/project-manager/types'
import type { ProjectFormValues } from '@/features/project-manager/schemas'
import { toDateInputValue } from '@/features/project-manager/lib/projectDate'

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
    managerId: managerId ?? '',
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
    totalInvestment: project.totalInvestment ?? '',
    status:
      (project.status as ProjectFormValues['status']) || 'IN_PROGRESS',
    managerId: project.managerId ?? '',
  }
}
