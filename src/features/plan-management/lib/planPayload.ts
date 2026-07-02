import type {
  CreatePlanFormValues,
  UpdatePlanFormValues,
} from '@/features/plan-management/schemas'
import type {
  CreateProjectPlanPayloadT,
  ProjectPlanPaperPlanPayloadT,
  ProjectPlanT,
  UpdateProjectPlanPayloadT,
} from '@/features/plan-management/types'

export function buildCreatePlanPayload(
  values: CreatePlanFormValues,
  resolvedPaperPlans: ProjectPlanPaperPlanPayloadT[],
): CreateProjectPlanPayloadT {
  return {
    name: values.name.trim(),
    projectCode: values.projectCode.trim(),
    dossierCount: String(values.dossierCount),
    startDate: values.startDate,
    endDate: values.endDate,
    dateCount: String(values.dateCount),
    paperPlans: resolvedPaperPlans,
  }
}

export function buildUpdatePlanPayload(
  values: UpdatePlanFormValues,
): UpdateProjectPlanPayloadT {
  return {
    name: values.name.trim(),
    projectCode: values.projectCode.trim(),
    dossierCount: String(values.dossierCount),
    startDate: values.startDate,
    endDate: values.endDate,
    dateCount: String(values.dateCount),
  }
}

export function planToFormValues(plan: ProjectPlanT): UpdatePlanFormValues {
  return {
    name: plan.name,
    projectCode: plan.projectCode,
    dossierCount: plan.dossierCount,
    dateCount: plan.dateCount,
    startDate: plan.startDate,
    endDate: plan.endDate,
  }
}
