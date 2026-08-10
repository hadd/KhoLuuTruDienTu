import type {
  DisposalCandidateGroupT,
  DisposalCandidateItemT,
} from '@/features/archive-disposal/types'

export function canSelectItemFond(
  itemFondId: string | null | undefined,
  anchorFondId: string | null,
  lockedFondId?: string | null,
): boolean {
  if (!itemFondId?.trim()) return false
  const fond = itemFondId.trim()
  if (lockedFondId?.trim() && fond !== lockedFondId.trim()) return false
  if (anchorFondId && fond !== anchorFondId) return false
  return true
}

export function resolveSelectionFondIdFromGroups(
  groups: Array<DisposalCandidateGroupT>,
  selectedKeys: Set<string>,
  itemKey: (item: DisposalCandidateItemT) => string,
): string | null {
  for (const group of groups) {
    if (group.dossierItem && selectedKeys.has(itemKey(group.dossierItem))) {
      return group.dossierItem.fondId?.trim() ?? null
    }
    for (const doc of group.documentItems) {
      if (selectedKeys.has(itemKey(doc))) {
        return doc.fondId?.trim() ?? null
      }
    }
  }
  return null
}

export function collectSelectableKeysForFond(
  groups: Array<DisposalCandidateGroupT>,
  itemKey: (item: DisposalCandidateItemT) => string,
  fondId: string,
  kind: 'dossier' | 'all',
): Array<string> {
  const keys: Array<string> = []
  const target = fondId.trim()
  for (const group of groups) {
    if (group.fondId?.trim() !== target) continue
    if (kind === 'dossier' || kind === 'all') {
      if (group.dossierItem) keys.push(itemKey(group.dossierItem))
    }
    if (kind === 'all') {
      for (const doc of group.documentItems) {
        keys.push(itemKey(doc))
      }
    }
  }
  return keys
}

export function selectedItemsShareOneFond(
  items: Array<DisposalCandidateItemT>,
): { ok: true; fondId: string } | { ok: false } {
  const fondIds = new Set(
    items.map((i) => i.fondId?.trim()).filter((id): id is string => Boolean(id)),
  )
  if (fondIds.size !== 1 || items.some((i) => !i.fondId?.trim())) {
    return { ok: false }
  }
  return { ok: true, fondId: [...fondIds][0]! }
}
