import {
  FileText,
  FolderOpen,
  FolderTree,
  Inbox,
  type LucideIcon,
} from 'lucide-react'

import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'

export type ArchiveWarehouseBrowseTabConfigItem = {
  value: ArchiveWarehouseBrowseViewT
  icon: LucideIcon
  labelKey:
    | 'page.browseTabFonds'
    | 'page.browseTabDossierTypes'
    | 'page.browseTabDocumentTypes'
    | 'page.browseTabUnassigned'
  descriptionKey:
    | 'browseNav.fondsDescription'
    | 'browseNav.dossierTypesDescription'
    | 'browseNav.documentTypesDescription'
    | 'browseNav.unassignedDescription'
}

export const ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG: Array<ArchiveWarehouseBrowseTabConfigItem> =
  [
    {
      value: 'fonds',
      icon: FolderTree,
      labelKey: 'page.browseTabFonds',
      descriptionKey: 'browseNav.fondsDescription',
    },
    {
      value: 'dossierTypes',
      icon: FolderOpen,
      labelKey: 'page.browseTabDossierTypes',
      descriptionKey: 'browseNav.dossierTypesDescription',
    },
    {
      value: 'documentTypes',
      icon: FileText,
      labelKey: 'page.browseTabDocumentTypes',
      descriptionKey: 'browseNav.documentTypesDescription',
    },
    {
      value: 'unassigned',
      icon: Inbox,
      labelKey: 'page.browseTabUnassigned',
      descriptionKey: 'browseNav.unassignedDescription',
    },
  ]
