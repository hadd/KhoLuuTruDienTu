import type { CreatePlanFormValues } from '@/features/plan-management/schemas'
import type {
  CreateProjectPlanPayloadT,
  ProjectPlanT,
} from '@/features/plan-management/types'

export function buildCreatePlanPayload(
  values: CreatePlanFormValues,
): CreateProjectPlanPayloadT {
  return {
    name: values.name.trim(),
    projectCode: values.projectCode.trim(),
    a4Pages: values.a4Pages,
    a3Pages: values.a3Pages,
    dossierCount: values.dossierCount,
    quota: values.quota.trim(),
    startDate: values.startDate,
    endDate: values.endDate,
  }
}

export const buildUpdatePlanPayload = buildCreatePlanPayload

export function planToFormValues(plan: ProjectPlanT): CreatePlanFormValues {
  return {
    name: plan.name,
    projectCode: plan.projectCode,
    a4Pages: plan.a4Pages,
    a3Pages: plan.a3Pages,
    dossierCount: plan.dossierCount,
    quota: plan.quota,
    startDate: plan.startDate,
    endDate: plan.endDate,
  }
}