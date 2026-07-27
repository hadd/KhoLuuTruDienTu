import { isUnassignedWarehouseFondId } from '@/features/archive-warehouse/lib/unassignedFond'
import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import { ARCHIVE_WAREHOUSE_BROWSE_VIEWS } from '@/features/archive-warehouse/schemas'

export function isArchiveWarehouseDossiersModuleActive(
  pathname: string,
  tab?: string,
): boolean {
  if (pathname.startsWith('/app/archive-dossiers')) return true
  if (pathname === '/app/archive-warehouse' && tab === 'dossiers') return true
  return false
}

function isBrowseView(value: string | undefined): value is ArchiveWarehouseBrowseViewT {
  return (
    value != null &&
    (ARCHIVE_WAREHOUSE_BROWSE_VIEWS as ReadonlyArray<string>).includes(value)
  )
}

export function resolveArchiveWarehouseBrowseView(input: {
  pathname: string
  tab?: string
  browseView?: string
  fondId?: string
}): ArchiveWarehouseBrowseViewT | undefined {
  if (!isArchiveWarehouseDossiersModuleActive(input.pathname, input.tab)) {
    return undefined
  }

  if (input.pathname.includes('/by-dossier-type/')) {
    return 'dossierTypes'
  }
  if (input.pathname.includes('/by-document-type/')) {
    return 'documentTypes'
  }
  if (input.pathname.startsWith('/app/archive-dossiers/')) {
    if (input.fondId && isUnassignedWarehouseFondId(input.fondId)) {
      return 'unassigned'
    }
    return 'fonds'
  }

  if (isBrowseView(input.browseView)) {
    return input.browseView
  }

  return 'fonds'
}
