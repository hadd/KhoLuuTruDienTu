import type { ReactNode } from 'react'

import {
  WarehouseSectionTabs,
  type WarehouseSectionTabT,
} from '@/features/warehouse-management/components/WarehouseSectionTabs'
import { WarehouseCollapsibleSubTabs } from '@/features/warehouse-management/components/WarehouseCollapsibleSubTabs'
import { useWarehouseSubTabsExpanded } from '@/features/warehouse-management/hooks/useWarehouseSubTabsExpanded'

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
  const { expanded, setExpanded } = useWarehouseSubTabsExpanded()

  return (
    <div className="-mx-6 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-6">
      <WarehouseSectionTabs active={section} compact />

      <WarehouseCollapsibleSubTabs
        expanded={expanded}
        onExpandedChange={setExpanded}
        visible={hasSubTabs}
      >
        {subTabs}
      </WarehouseCollapsibleSubTabs>

      <div className="mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </div>
    </div>
  )
}
