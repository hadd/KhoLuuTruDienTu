import type { ReactNode } from 'react'

import {
  ArchiveDataHubSubTabs,
  useArchiveDataHubSubTabsVisible,
} from '@/features/archive-warehouse/components/ArchiveDataHubSubTabs'
import {
  ArchiveWarehouseBrowseSubTabs,
  useArchiveWarehouseBrowseSubTabsVisible,
} from '@/features/archive-warehouse/components/ArchiveWarehouseBrowseSubTabs'
import { WarehousePageShell } from '@/features/warehouse-management/components/WarehousePageShell'

type ArchiveWarehouseDataShellProps = {
  children: ReactNode
}

export function ArchiveWarehouseDataShell({
  children,
}: ArchiveWarehouseDataShellProps) {
  const hasModuleSubTabs = useArchiveDataHubSubTabsVisible()
  const hasBrowseSubTabs = useArchiveWarehouseBrowseSubTabsVisible()

  return (
    <WarehousePageShell
      section="data"
      hasSubTabs={hasModuleSubTabs || hasBrowseSubTabs}
      subTabs={
        <div className="flex min-w-0 flex-col gap-0.5">
          {hasModuleSubTabs ? <ArchiveDataHubSubTabs /> : null}
          {hasBrowseSubTabs ? <ArchiveWarehouseBrowseSubTabs /> : null}
        </div>
      }
    >
      {children}
    </WarehousePageShell>
  )
}
