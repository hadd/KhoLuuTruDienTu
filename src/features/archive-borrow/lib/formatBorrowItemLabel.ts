import type { ArchiveBorrowItemT } from '@/features/archive-borrow/types'

export function formatBorrowItemLabel(item: ArchiveBorrowItemT): string {
  const dossierName = item.dossierName?.trim() || item.dossierId
  if (item.itemKind === 'FILE') {
    const fileName = item.fileName?.trim()
    return fileName ? `${dossierName} / ${fileName}` : dossierName
  }
  if (item.itemKind === 'DOSSIER' && item.fileCount != null) {
    return `${dossierName} (${item.fileCount})`
  }
  return dossierName
}
