import {
  FileText,
  FolderOpen,
  FolderTree,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import {
  warehouseSubTabsDenseListClassName,
  warehouseSubTabsDenseTriggerClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'

export type { ArchiveWarehouseBrowseViewT }

type ArchiveWarehouseBrowseTabsProps = {
  browseView: ArchiveWarehouseBrowseViewT
  onBrowseViewChange: (view: ArchiveWarehouseBrowseViewT) => void
  className?: string
}

const BROWSE_TAB_ORDER: Array<{
  value: ArchiveWarehouseBrowseViewT
  labelKey:
    | 'page.browseTabFonds'
    | 'page.browseTabDossierTypes'
    | 'page.browseTabDocumentTypes'
    | 'page.browseTabUnassigned'
  icon: LucideIcon
}> = [
  { value: 'fonds', labelKey: 'page.browseTabFonds', icon: FolderTree },
  { value: 'dossierTypes', labelKey: 'page.browseTabDossierTypes', icon: FolderOpen },
  { value: 'documentTypes', labelKey: 'page.browseTabDocumentTypes', icon: FileText },
  { value: 'unassigned', labelKey: 'page.browseTabUnassigned', icon: Inbox },
]

export function ArchiveWarehouseBrowseTabs({
  browseView,
  onBrowseViewChange,
  className,
}: ArchiveWarehouseBrowseTabsProps) {
  const { t } = useTranslation('archive-warehouse')

  return (
    <nav
      className={cn(warehouseSubTabsDenseListClassName, className)}
      aria-label={t('page.fondFilterLabel')}
    >
      {BROWSE_TAB_ORDER.map((tab) => {
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
