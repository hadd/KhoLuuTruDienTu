import type { ReactNode } from 'react'

import {
  WarehouseSectionTabs,
  type WarehouseSectionTabT,
} from '@/features/warehouse-management/components/WarehouseSectionTabs'

type WarehousePageShellProps = {
  section: WarehouseSectionTabT
  hasSubTabs?: boolean
  subTabs?: ReactNode
  children: ReactNode
}

export function WarehousePageShell({
  section,
  hasSubTabs = false,
  subTabs = null,
  children,
}: WarehousePageShellProps) {
  return (
    <div className="-mx-6 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-6">
      <div className="flex shrink-0 items-end">
        <WarehouseSectionTabs
          active={section}
          compact
          className="min-w-0 flex-1"
        />
      </div>

      {hasSubTabs && subTabs ? (
        <div className="flex shrink-0 flex-col">{subTabs}</div>
      ) : null}

      <div className="mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </div>
    </div>
  )
}
