import {
  createPaperSize,
  getPaperSizes,
} from '@/features/plan-management/api/paperSizeClient'
import type { PaperPlanRowFormValues } from '@/features/plan-management/lib/planPaperPlanRowSchema'
import type {
  PaperSizeT,
  ProjectPlanPaperPlanPayloadT,
} from '@/features/plan-management/types'

function indexPaperSizesByName(
  paperSizes: PaperSizeT[],
): Map<string, string> {
  const map = new Map<string, string>()

  for (const size of paperSizes) {
    map.set(size.name.trim().toLowerCase(), size.id)
  }

  return map
}

async function resolvePaperSizeId(
  paperSizeName: string,
  resolvedIdsByName: Map<string, string>,
): Promise<string> {
  const trimmedName = paperSizeName.trim()
  const normalizedName = trimmedName.toLowerCase()
  const existingId = resolvedIdsByName.get(normalizedName)

  if (existingId) {
    return existingId
  }

  try {
    const created = await createPaperSize({ name: trimmedName })
    resolvedIdsByName.set(normalizedName, created.id)
    return created.id
  } catch (error) {
    const refreshed = await getPaperSizes()
    const refreshedMap = indexPaperSizesByName(refreshed.items)
    const refreshedId = refreshedMap.get(normalizedName)

    if (refreshedId) {
      resolvedIdsByName.set(normalizedName, refreshedId)
      return refreshedId
    }

    throw error
  }
}

export async function resolvePaperPlansForSubmit(
  paperPlans: PaperPlanRowFormValues[],
  existingPaperSizes: PaperSizeT[],
): Promise<ProjectPlanPaperPlanPayloadT[]> {
  const resolvedIdsByName = indexPaperSizesByName(existingPaperSizes)
  const result: ProjectPlanPaperPlanPayloadT[] = []

  for (const row of paperPlans) {
    const paperSizeId = await resolvePaperSizeId(
      row.paperSizeName,
      resolvedIdsByName,
    )

    result.push({
      paperSizeId,
      quantity: String(row.quantity),
    })
  }

  return result
}
