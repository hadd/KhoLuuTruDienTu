import { getPaperSizes } from '@/features/plan-management/api/paperSizeClient'
import { updateProjectPlan } from '@/features/plan-management/api/planManagementClient'
import { buildUpdatePlanPayload } from '@/features/plan-management/lib/planPayload'
import { resolvePaperPlansForSubmit } from '@/features/plan-management/lib/resolvePaperPlansForSubmit'
import type { UpdatePlanFormValues } from '@/features/plan-management/schemas'
import type { ProjectPlanT } from '@/features/plan-management/types'

export async function submitUpdatePlanFlow(
  id: string,
  values: UpdatePlanFormValues,
): Promise<ProjectPlanT> {
  const paperSizesResponse = await getPaperSizes()
  const resolvedPaperPlans = await resolvePaperPlansForSubmit(
    values.paperPlans,
    paperSizesResponse.items,
  )

  return updateProjectPlan(id, buildUpdatePlanPayload(values, resolvedPaperPlans))
}
