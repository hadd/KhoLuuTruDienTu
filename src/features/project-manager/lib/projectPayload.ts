import type { CreateProjectPayloadT, ProjectT } from '@/features/project-manager/types'
import type { ProjectFormValues } from '@/features/project-manager/schemas'

export function buildProjectPayload(
  value: ProjectFormValues,
): CreateProjectPayloadT {
  return {
    projectCode: value.projectCode.trim(),
    projectName: value.projectName.trim(),
    projectType: value.projectType.trim(),
    investor: value.investor.trim(),
    acceptanceDate: value.acceptanceDate,
    status: value.status,
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
    startDate: project.startDate ?? '',
    acceptanceDate: project.acceptanceDate ?? '',
    totalInvestment: project.totalInvestment ?? '',
    status:
      (project.status as ProjectFormValues['status']) || 'IN_PROGRESS',
  }
}
