import type { DataDossierMetadataT, DataTreeNodeT, MakerClaimT } from '@/features/data-management/types'

export function countMetadataFields(
  metadata: DataDossierMetadataT | undefined,
): number {
  if (!metadata?.metadata_groups?.length) return 0
  return metadata.metadata_groups.reduce(
    (sum, group) => sum + group.fields.length,
    0,
  )
}

export function normalizeAllowedFields(
  allowedFields: Array<string> | null | undefined,
): Array<string> | undefined {
  if (!Array.isArray(allowedFields)) return undefined
  const normalized = allowedFields.filter(
    (field) => typeof field === 'string' && field.trim() !== '',
  )
  return normalized.length > 0 ? normalized : undefined
}

export function parseShouldPdfMaskFromClaim(
  claim: Pick<MakerClaimT, 'allowedFields'>,
): boolean {
  return Boolean(normalizeAllowedFields(claim.allowedFields)?.length)
}

export function resolveShouldPdfMaskFromMetadata(input: {
  allowedFields?: Array<string> | null
  dossierMetadata?: DataDossierMetadataT
  fullDossierMetadata?: DataDossierMetadataT
}): boolean {
  if (normalizeAllowedFields(input.allowedFields)?.length) return true

  const visibleCount = countMetadataFields(input.dossierMetadata)
  const fullCount = countMetadataFields(input.fullDossierMetadata)
  return fullCount > 0 && visibleCount < fullCount
}

/** Group slot workflow (limited metadata) → mask ON; full metadata → mask OFF. */
export function resolveEditorPdfMaskEnabled(node: DataTreeNodeT): boolean {
  if (node.shouldPdfMask != null) return node.shouldPdfMask

  return resolveShouldPdfMaskFromMetadata({
    allowedFields: node.allowedFields,
    dossierMetadata: node.dossierMetadata,
    fullDossierMetadata: node.fullDossierMetadata,
  })
}
