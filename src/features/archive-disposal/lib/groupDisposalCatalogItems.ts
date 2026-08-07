import type {
  DisposalCatalogReferenceFileT,
  DisposalProposalItemT,
} from '@/features/archive-disposal/types'

export type DisposalCatalogEvaluationScopeT = 'DOSSIER' | 'DOCUMENT'

export type DisposalCatalogDossierGroupT = {
  dossierId: string
  dossierName: string
  dossierItem: DisposalProposalItemT | null
  documentItems: Array<DisposalProposalItemT>
  evaluationScope: DisposalCatalogEvaluationScopeT
  referenceDocuments: Array<DisposalCatalogReferenceFileT>
}

export function groupDisposalCatalogItems(
  items: Array<DisposalProposalItemT>,
  referenceFilesByDossierId: Record<
    string,
    Array<DisposalCatalogReferenceFileT>
  > = {},
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
        evaluationScope: 'DOCUMENT',
        referenceDocuments: [],
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

  for (const group of byDossier.values()) {
    group.evaluationScope = group.dossierItem != null ? 'DOSSIER' : 'DOCUMENT'
    if (group.evaluationScope === 'DOSSIER') {
      group.referenceDocuments =
        referenceFilesByDossierId[group.dossierId] ?? []
    }
  }

  return Array.from(byDossier.values()).sort((a, b) =>
    a.dossierName.localeCompare(b.dossierName, 'vi'),
  )
}
