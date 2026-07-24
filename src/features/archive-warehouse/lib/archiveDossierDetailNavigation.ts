import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'

export type ArchiveDossierDetailSearchContext = {
  browseView?: ArchiveWarehouseBrowseViewT
  dossierTypeId?: string
  documentTypeId?: string
}

export function buildArchiveDossierDetailSearch(
  context: ArchiveDossierDetailSearchContext & {
    browseView: ArchiveWarehouseBrowseViewT
  },
  extra?: Record<string, unknown>,
) {
  return {
    browseView: context.browseView,
    ...(context.dossierTypeId ? { dossierTypeId: context.dossierTypeId } : {}),
    ...(context.documentTypeId ? { documentTypeId: context.documentTypeId } : {}),
    ...extra,
  }
}
