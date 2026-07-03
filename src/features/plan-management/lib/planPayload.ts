import { createEmptyPaperPlanRow } from '@/features/plan-management/lib/planPaperPlanDefaults'
import type {
  CreatePlanFormValues,
  UpdatePlanFormValues,
} from '@/features/plan-management/schemas'
import type {
  CreateProjectPlanPayloadT,
  PaperSizeT,
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
  resolvedPaperPlans: ProjectPlanPaperPlanPayloadT[],
): UpdateProjectPlanPayloadT {
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

export function planToFormValues(
  plan: ProjectPlanT,
  paperSizes: PaperSizeT[],
): UpdatePlanFormValues {
  const sizeNameById = new Map(paperSizes.map((ps) => [ps.id, ps.name]))

  return {
    name: plan.name,
    projectCode: plan.projectCode,
    dossierCount: plan.dossierCount,
    dateCount: plan.dateCount,
    startDate: plan.startDate,
    endDate: plan.endDate,
    paperPlans:
      plan.paperPlans.length > 0
        ? plan.paperPlans.map((pp) => ({
            paperSizeName: sizeNameById.get(pp.paperSizeId) ?? '',
            quantity: pp.quantity,
          }))
        : [createEmptyPaperPlanRow()],
  }
}
