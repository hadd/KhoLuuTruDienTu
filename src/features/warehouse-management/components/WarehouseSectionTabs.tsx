import { Link } from '@tanstack/react-router'
import { Database, Warehouse } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  warehouseTabsListClassName,
  warehouseTabsTriggerClassName,
  warehouseTabsTriggerCompactClassName,
} from '@/features/warehouse-management/components/WarehouseManagementBackNav'
import { cn } from '@/lib/utils/cn'

export type WarehouseSectionTabT = 'physical' | 'data'

type WarehouseSectionTabItem = {
  id: WarehouseSectionTabT
  to: '/app/physical-warehouse' | '/app/archive-warehouse'
  label: string
  icon: typeof Warehouse
}

export function useWarehouseSectionTabs(): Array<WarehouseSectionTabItem> {
  const { t } = useTranslation('warehouse-management')
  const { canViewPhysicalWarehouse } = usePhysicalWarehouseAccess()
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenDataWarehouse =
    canReadArchiveWarehouse ||
    canSubmitArchive ||
    canReviewArchive ||
    canManageArchiveConfig ||
    canManageArchivePermissions ||
    primaryRole === 'admin' ||
    primaryRole === 'manager'

  return useMemo(() => {
    const items: Array<WarehouseSectionTabItem> = []

    if (canViewPhysicalWarehouse) {
      items.push({
        id: 'physical',
        to: '/app/physical-warehouse',
        label: t('sectionTabs.physical'),
        icon: Warehouse,
      })
    }
    if (canOpenDataWarehouse) {
      items.push({
        id: 'data',
        to: '/app/archive-warehouse',
        label: t('sectionTabs.data'),
        icon: Database,
      })
    }

    return items
  }, [canViewPhysicalWarehouse, canOpenDataWarehouse, t])
}

export function WarehouseSectionTabs({
  active,
  compact = false,
}: {
  active: WarehouseSectionTabT
  compact?: boolean
}) {
  const tabs = useWarehouseSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  const triggerClassName = compact
    ? warehouseTabsTriggerCompactClassName
    : warehouseTabsTriggerClassName

  return (
    <nav
      className={warehouseTabsListClassName}
      aria-label="Warehouse sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active

        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(triggerClassName, 'inline-flex items-center')}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
