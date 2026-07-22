import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils/cn'

export type ArchiveWarehouseBrowseViewT = 'fonds' | 'unassigned'

export const archiveWarehouseBrowseTabsListClassName =
  'flex min-w-0 items-center gap-6 border-b border-border'

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
      <button
        type="button"
        className={archiveWarehouseBrowseTabTriggerClassName(browseView === 'fonds')}
        aria-current={browseView === 'fonds' ? 'page' : undefined}
        onClick={() => onBrowseViewChange('fonds')}
      >
        {t('page.browseTabFonds')}
      </button>
      <button
        type="button"
        className={archiveWarehouseBrowseTabTriggerClassName(
          browseView === 'unassigned',
        )}
        aria-current={browseView === 'unassigned' ? 'page' : undefined}
        onClick={() => onBrowseViewChange('unassigned')}
      >
        {t('page.browseTabUnassigned')}
      </button>
    </nav>
  )
}
