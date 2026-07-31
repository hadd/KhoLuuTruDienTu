import type { ReactNode } from 'react'

import {
  ArchiveDataHubSubTabs,
  useArchiveDataHubSubTabsVisible,
} from '@/features/archive-warehouse/components/ArchiveDataHubSubTabs'
import {
  ArchiveDisposalSubTabs,
  useArchiveDisposalSubTabsVisible,
} from '@/features/archive-warehouse/components/ArchiveDisposalSubTabs'
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
  const hasDisposalSubTabs = useArchiveDisposalSubTabsVisible()

  return (
    <WarehousePageShell
      section="data"
      hasSubTabs={hasModuleSubTabs || hasBrowseSubTabs || hasDisposalSubTabs}
      subTabs={
        <div className="flex min-w-0 flex-col gap-0.5">
          {hasModuleSubTabs ? <ArchiveDataHubSubTabs /> : null}
          {hasBrowseSubTabs ? <ArchiveWarehouseBrowseSubTabs /> : null}
          {hasDisposalSubTabs ? <ArchiveDisposalSubTabs /> : null}
        </div>
      }
    >
      {children}
    </WarehousePageShell>
  )
}
