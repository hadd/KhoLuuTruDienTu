import { getPaperSizes } from '@/features/plan-management/api/paperSizeClient'
import { createProjectPlan } from '@/features/plan-management/api/planManagementClient'
import { buildCreatePlanPayload } from '@/features/plan-management/lib/planPayload'
import { resolvePaperPlansForSubmit } from '@/features/plan-management/lib/resolvePaperPlansForSubmit'
import type { CreatePlanFormValues } from '@/features/plan-management/schemas'
import type { ProjectPlanT } from '@/features/plan-management/types'

export async function submitCreatePlanFlow(
  values: CreatePlanFormValues,
): Promise<ProjectPlanT> {
  const paperSizesResponse = await getPaperSizes()
  const resolvedPaperPlans = await resolvePaperPlansForSubmit(
    values.paperPlans,
    paperSizesResponse.items,
  )

  return createProjectPlan(
    buildCreatePlanPayload(values, resolvedPaperPlans),
  )
}
