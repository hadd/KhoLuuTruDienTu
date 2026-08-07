import { useTranslation } from 'react-i18next'

import { ARCHIVE_DISPOSAL_TAB_CONFIG } from '@/features/archive-warehouse/lib/archiveDisposalTabConfig'
import type { ArchiveDisposalViewT } from '@/features/archive-warehouse/schemas'
import {
  warehouseTabsListClassName,
  warehouseTabsTriggerCompactClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'

type ArchiveDisposalTabsProps = {
  disposalView: ArchiveDisposalViewT
  showProposal: boolean
  showList?: boolean
  onDisposalViewChange: (view: ArchiveDisposalViewT) => void
  className?: string
}

export function ArchiveDisposalTabs({
  disposalView,
  showProposal,
  showList = true,
  onDisposalViewChange,
  className,
}: ArchiveDisposalTabsProps) {
  const { t } = useTranslation('archive-warehouse')

  const visibleTabs = ARCHIVE_DISPOSAL_TAB_CONFIG.filter(
    (tab) =>
      (tab.value === 'list' && showList) ||
      (tab.value === 'proposal' && showProposal),
  )

  return (
    <nav
      className={cn(warehouseTabsListClassName, 'border-b-0', className)}
      aria-label={t('disposal.subTabsAriaLabel')}
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon
        const isActive = disposalView === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            className={cn(
              warehouseTabsTriggerCompactClassName,
              'inline-flex items-center',
            )}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onDisposalViewChange(tab.value)}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {t(tab.labelKey)}
          </button>
        )
      })}
    </nav>
  )
}
