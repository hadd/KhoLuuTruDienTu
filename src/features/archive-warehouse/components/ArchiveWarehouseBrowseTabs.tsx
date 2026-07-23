import { useTranslation } from 'react-i18next'

import type { ArchiveWarehouseBrowseViewT } from '@/features/archive-warehouse/schemas'
import { cn } from '@/lib/utils/cn'

export type { ArchiveWarehouseBrowseViewT }

export const archiveWarehouseBrowseTabsListClassName =
  'flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border'

export function archiveWarehouseBrowseTabTriggerClassName(active: boolean) {
  return cn(
    '-mb-px inline-flex items-center border-b-2 px-0 pb-2.5 pt-1 text-sm font-medium transition-colors',
    active
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  )
}

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
}> = [
  { value: 'fonds', labelKey: 'page.browseTabFonds' },
  { value: 'dossierTypes', labelKey: 'page.browseTabDossierTypes' },
  { value: 'documentTypes', labelKey: 'page.browseTabDocumentTypes' },
  { value: 'unassigned', labelKey: 'page.browseTabUnassigned' },
]

export function ArchiveWarehouseBrowseTabs({
  browseView,
  onBrowseViewChange,
  className,
}: ArchiveWarehouseBrowseTabsProps) {
  const { t } = useTranslation('archive-warehouse')

  return (
    <nav
      className={cn(archiveWarehouseBrowseTabsListClassName, className)}
      aria-label={t('page.fondFilterLabel')}
    >
      {BROWSE_TAB_ORDER.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={archiveWarehouseBrowseTabTriggerClassName(browseView === tab.value)}
          aria-current={browseView === tab.value ? 'page' : undefined}
          onClick={() => onBrowseViewChange(tab.value)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  )
}
