import type { ReactNode } from 'react'

import { WarehouseSectionTabs } from '@/features/warehouse-management/components/WarehouseSectionTabs'

type ArchiveWarehouseDataShellProps = {
  children: ReactNode
}

export function ArchiveWarehouseDataShell({
  children,
}: ArchiveWarehouseDataShellProps) {
  return (
    <div className="-mx-6 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-6">
      <WarehouseSectionTabs active="data" compact />

      <div className="mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </div>
    </div>
  )
}
