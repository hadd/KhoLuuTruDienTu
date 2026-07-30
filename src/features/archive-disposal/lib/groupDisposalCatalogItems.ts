import type { DisposalProposalItemT } from '@/features/archive-disposal/types'

export type DisposalCatalogDossierGroupT = {
  dossierId: string
  dossierName: string
  dossierItem: DisposalProposalItemT | null
  documentItems: Array<DisposalProposalItemT>
}

export function groupDisposalCatalogItems(
  items: Array<DisposalProposalItemT>,
): Array<DisposalCatalogDossierGroupT> {
  const byDossier = new Map<string, DisposalCatalogDossierGroupT>()

  for (const item of items) {
    let group = byDossier.get(item.dossierId)
    if (!group) {
      group = {
        dossierId: item.dossierId,
        dossierName: item.dossierName ?? item.dossierId,
        dossierItem: null,
        documentItems: [],
      }
      byDossier.set(item.dossierId, group)
    }

    if (item.fileId == null) {
      group.dossierItem = item
    } else {
      group.documentItems.push(item)
    }

    if (item.dossierName) {
      group.dossierName = item.dossierName
    }
  }

  return Array.from(byDossier.values()).sort((a, b) =>
    a.dossierName.localeCompare(b.dossierName, 'vi'),
  )
}
