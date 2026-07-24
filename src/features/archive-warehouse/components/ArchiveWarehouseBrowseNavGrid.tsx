import {
  FileText,
  FolderOpen,
  FolderTree,
  Inbox,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import {
  WarehouseIconTile,
  WarehouseIconTileGrid,
} from '@/features/warehouse-management/components/WarehouseIconTile'

const BROWSE_TAB_CONFIG: Array<{
  value: ArchiveWarehouseBrowseViewT
  icon: typeof FolderTree
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
}> = [
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

export function ArchiveWarehouseBrowseNavGrid({
  browseView,
  onBrowseViewChange,
}: {
  browseView?: ArchiveWarehouseBrowseViewT
  onBrowseViewChange: (view: ArchiveWarehouseBrowseViewT) => void
}) {
  const { t } = useTranslation('archive-warehouse')

  return (
    <WarehouseIconTileGrid>
      {BROWSE_TAB_CONFIG.map((item) => {
        const Icon = item.icon
        return (
          <WarehouseIconTile
            key={item.value}
            icon={Icon}
            label={t(item.labelKey)}
            description={t(item.descriptionKey)}
            selected={browseView === item.value}
            onClick={() => onBrowseViewChange(item.value)}
          />
        )
      })}
    </WarehouseIconTileGrid>
  )
}
