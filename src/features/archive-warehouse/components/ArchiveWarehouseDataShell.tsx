import type { ReactNode } from 'react'

import {
  ArchiveDataHubSubTabs,
  useArchiveDataHubSubTabsVisible,
} from '@/features/archive-warehouse/components/ArchiveDataHubSubTabs'
import {
  ArchiveDisposalSubTabs,
  useArchiveDisposalSubTabsVisible,
} from '@/features/archive-warehouse/components/ArchiveDisposalSubTabs'
import { WarehousePageShell } from '@/features/warehouse-management/components/WarehousePageShell'

type ArchiveWarehouseDataShellProps = {
  children: ReactNode
}

export function ArchiveWarehouseDataShell({
  children,
}: ArchiveWarehouseDataShellProps) {
  const hasModuleSubTabs = useArchiveDataHubSubTabsVisible()
  const hasDisposalSubTabs = useArchiveDisposalSubTabsVisible()

  return (
    <WarehousePageShell
      section="data"
      hasSubTabs={hasModuleSubTabs || hasDisposalSubTabs}
      subTabs={
        <>
          {hasModuleSubTabs ? <ArchiveDataHubSubTabs /> : null}
          {hasDisposalSubTabs ? <ArchiveDisposalSubTabs /> : null}
        </>
      }
    >
      {children}
    </WarehousePageShell>
  )
}
