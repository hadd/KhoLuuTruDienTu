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
import { cn } from '@/lib/utils/cn'

export function WarehouseManagementPage() {
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

  const tiles = useMemo(() => {
    const items: Array<{
      id: string
      to: '/app/physical-warehouse' | '/app/archive-warehouse'
      label: string
      icon: typeof Warehouse
    }> = []

    if (canViewPhysicalWarehouse) {
      items.push({
        id: 'physical',
        to: '/app/physical-warehouse',
        label: t('tiles.physical'),
        icon: Warehouse,
      })
    }
    if (canOpenDataWarehouse) {
      items.push({
        id: 'data',
        to: '/app/archive-warehouse',
        label: t('tiles.data'),
        icon: Database,
      })
    }
    return items
  }, [canViewPhysicalWarehouse, canOpenDataWarehouse, t])

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-14">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10 sm:gap-12">
        <h1 className="flex items-center gap-3 text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
          <span className="inline-block h-7 w-1 shrink-0 rounded-sm bg-primary sm:h-8" />
          {t('title')}
        </h1>

        <div
          className={cn(
            'grid w-full gap-8 sm:gap-10',
            tiles.length === 1
              ? 'max-w-xs grid-cols-1'
              : 'grid-cols-1 sm:grid-cols-2',
          )}
        >
          {tiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.id}
                to={tile.to}
                className="group flex flex-col items-center gap-4 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-36 items-center justify-center rounded-[2rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-44">
                  <Icon
                    className="size-16 sm:size-20"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
                <span className="text-center text-lg font-medium text-foreground transition-colors group-hover:text-primary sm:text-xl">
                  {tile.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
