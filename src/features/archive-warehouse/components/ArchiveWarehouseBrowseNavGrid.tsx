import { useTranslation } from 'react-i18next'

import { ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG } from '@/features/archive-warehouse/lib/archiveWarehouseBrowseTabConfig'
import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import {
  WarehouseIconTile,
  WarehouseIconTileGrid,
} from '@/features/warehouse-management/components/WarehouseIconTile'

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
      {ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG.map((item) => {
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
