import { useTranslation } from 'react-i18next'

import { ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG } from '@/features/archive-warehouse/lib/archiveWarehouseBrowseTabConfig'
import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import {
  warehouseSubTabsDenseInlineListClassName,
  warehouseSubTabsDenseTriggerClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'

export type { ArchiveWarehouseBrowseViewT }

type ArchiveWarehouseBrowseTabsProps = {
  browseView: ArchiveWarehouseBrowseViewT
  onBrowseViewChange: (view: ArchiveWarehouseBrowseViewT) => void
  className?: string
}

export function ArchiveWarehouseBrowseTabs({
  browseView,
  onBrowseViewChange,
  className,
}: ArchiveWarehouseBrowseTabsProps) {
  const { t } = useTranslation('archive-warehouse')

  return (
    <nav
      className={cn(warehouseSubTabsDenseInlineListClassName, className)}
      aria-label={t('browse.subTabsAriaLabel')}
    >
      {ARCHIVE_WAREHOUSE_BROWSE_TAB_CONFIG.map((tab) => {
        const Icon = tab.icon
        const isActive = browseView === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            className={cn(
              warehouseSubTabsDenseTriggerClassName,
              'inline-flex items-center',
            )}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onBrowseViewChange(tab.value)}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {t(tab.labelKey)}
          </button>
        )
      })}
    </nav>
  )
}
