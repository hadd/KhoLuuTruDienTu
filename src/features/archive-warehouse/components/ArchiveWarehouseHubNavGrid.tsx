import { useNavigate } from '@tanstack/react-router'
import {
  CheckCircle2,
  FolderOpen,
  Send,
  Settings2,
  Shield,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ArchiveDataHubTabT } from '@/features/archive-warehouse/schemas'
import {
  WarehouseIconTile,
  WarehouseIconTileGrid,
} from '@/features/warehouse-management/components/WarehouseIconTile'

const HUB_TAB_CONFIG: Array<{
  value: ArchiveDataHubTabT
  icon: typeof FolderOpen
  labelKey:
    | 'tabs.dossiers'
    | 'tabs.submission'
    | 'tabs.review'
    | 'tabs.config'
    | 'tabs.permission'
  descriptionKey:
    | 'hubNav.dossiersDescription'
    | 'hubNav.submissionDescription'
    | 'hubNav.reviewDescription'
    | 'hubNav.configDescription'
    | 'hubNav.permissionDescription'
}> = [
  {
    value: 'dossiers',
    icon: FolderOpen,
    labelKey: 'tabs.dossiers',
    descriptionKey: 'hubNav.dossiersDescription',
  },
  {
    value: 'submission',
    icon: Send,
    labelKey: 'tabs.submission',
    descriptionKey: 'hubNav.submissionDescription',
  },
  {
    value: 'review',
    icon: CheckCircle2,
    labelKey: 'tabs.review',
    descriptionKey: 'hubNav.reviewDescription',
  },
  {
    value: 'config',
    icon: Settings2,
    labelKey: 'tabs.config',
    descriptionKey: 'hubNav.configDescription',
  },
  {
    value: 'permission',
    icon: Shield,
    labelKey: 'tabs.permission',
    descriptionKey: 'hubNav.permissionDescription',
  },
]

export function ArchiveWarehouseHubNavGrid({
  availableTabs,
  activeTab,
}: {
  availableTabs: Array<ArchiveDataHubTabT>
  activeTab?: ArchiveDataHubTabT
}) {
  const { t } = useTranslation('archive-warehouse')
  const navigate = useNavigate({ from: '/app/archive-warehouse/' })

  const visibleTabs = HUB_TAB_CONFIG.filter((item) =>
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
