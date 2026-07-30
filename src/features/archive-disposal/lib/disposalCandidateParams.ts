import type { ArchiveDataHubSearchT } from '@/features/archive-warehouse/schemas'
import type {
  DisposalCandidateCategoryT,
  GetDisposalCandidatesParamsT,
} from '@/features/archive-disposal/types'

export function buildDisposalCandidateListParams(
  search: ArchiveDataHubSearchT,
): GetDisposalCandidatesParamsT {
  const category =
    (search.disposalCategory as DisposalCandidateCategoryT | undefined) ?? 'all'

  return {
    category,
    entityKind: 'dossier',
    fondId: search.searchFondId || undefined,
    dossierTypeId: search.dossierTypeId || undefined,
    documentTypeId: search.documentTypeId || undefined,
    retentionPeriodId: search.disposalRetentionPeriodId || undefined,
    physicalItemId: search.physicalItemId || undefined,
    dateFrom: search.disposalDateFrom || undefined,
    dateTo: search.disposalDateTo || undefined,
    search: search.q?.trim() || undefined,
    page: search.page ?? 1,
    limit: search.limit ?? 20,
  }
}

export function countDisposalCandidateFilters(search: ArchiveDataHubSearchT): number {
  let count = 0
  if (search.disposalCategory && search.disposalCategory !== 'all') count += 1
  if (search.searchFondId) count += 1
  if (search.dossierTypeId) count += 1
  if (search.documentTypeId) count += 1
  if (search.disposalRetentionPeriodId) count += 1
  if (search.physicalItemId) count += 1
  if (search.disposalDateFrom || search.disposalDateTo) count += 1
  return count
}

export function hasDisposalCandidateFilters(search: ArchiveDataHubSearchT): boolean {
  return countDisposalCandidateFilters(search) > 0 || Boolean(search.q?.trim())
}
