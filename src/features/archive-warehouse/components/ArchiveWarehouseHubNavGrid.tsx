import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ARCHIVE_DATA_HUB_TAB_CONFIG } from '@/features/archive-warehouse/lib/archiveDataHubTabConfig'
import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import {
  WarehouseIconTile,
  WarehouseIconTileGrid,
} from '@/features/warehouse-management/components/WarehouseIconTile'

export function ArchiveWarehouseHubNavGrid({
  availableTabs,
  activeTab,
}: {
  availableTabs: Array<ArchiveDataHubTabT>
  activeTab?: ArchiveDataHubTabT
}) {
  const { t } = useTranslation('archive-warehouse')
  const navigate = useNavigate({ from: '/app/archive-warehouse/' })

  const visibleTabs = ARCHIVE_DATA_HUB_TAB_CONFIG.filter((item) =>
    availableTabs.includes(item.value),
  )

  if (visibleTabs.length === 0) return null

  return (
    <WarehouseIconTileGrid>
      {visibleTabs.map((item) => {
        const Icon = item.icon
        return (
          <WarehouseIconTile
            key={item.value}
            icon={Icon}
            label={t(item.labelKey)}
            description={t(item.descriptionKey)}
            selected={activeTab === item.value}
            onClick={() => {
              void navigate({
                search: (prev) => {
                  if (item.value === 'dossiers') {
                    return {
                      tab: 'dossiers',
                      page: 1,
                      limit: prev.limit,
                    }
                  }
                  if (item.value === 'expiryReview') {
                    return {
                      tab: 'expiryReview',
                      disposalView: 'list',
                      page: 1,
                      limit: prev.limit,
                    }
                  }
                  return {
                    ...prev,
                    tab: item.value,
                    page: 1,
                  }
                },
              })
            }}
          />
        )
      })}
    </WarehouseIconTileGrid>
  )
}
