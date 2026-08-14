import { Link } from '@tanstack/react-router'
import { Database, Warehouse } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useArchiveConfigAccess } from '@/features/archive-config/hooks/useArchiveConfigAccess'
import { useArchiveDisposalAccess } from '@/features/archive-disposal/hooks/useArchiveDisposalAccess'
import { useArchiveSubmissionAccess } from '@/features/archive-submission/hooks/useArchiveSubmissionAccess'
import { useArchiveWarehouseAccess } from '@/features/archive-warehouse/hooks/useArchiveWarehouseAccess'
import { getPrimaryAppRole } from '@/features/auth/constants'
import { getUserRoles } from '@/features/auth/store'
import {
  IconHubPageLayout,
  iconHubTileGridGapClassName,
  iconHubTileIconClassName,
  iconHubTileIconWrapClassName,
  iconHubTileLabelClassName,
  iconHubTileLinkClassName,
} from '@/features/navigation/components/IconHubPageLayout'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import { cn } from '@/lib/utils/cn'

export function WarehouseManagementPage() {
  const { t } = useTranslation('warehouse-management')
  const { canViewPhysicalWarehouse } = usePhysicalWarehouseAccess()
  const { canReadArchiveWarehouse, canManageArchivePermissions } =
    useArchiveWarehouseAccess()
  const { canReadDisposal } = useArchiveDisposalAccess()
  const { canSubmitArchive, canReviewArchive } = useArchiveSubmissionAccess()
  const { canManageArchiveConfig } = useArchiveConfigAccess()

  const primaryRole = getPrimaryAppRole(getUserRoles())
  const canOpenDataWarehouse =
    canReadArchiveWarehouse ||
    canReadDisposal ||
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
    <IconHubPageLayout title={t('title')} maxWidth="max-w-3xl">
      <div
        className={cn(
          'grid w-full',
          iconHubTileGridGapClassName,
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
              className={iconHubTileLinkClassName}
            >
              <span className={iconHubTileIconWrapClassName}>
                <Icon
                  className={iconHubTileIconClassName}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className={iconHubTileLabelClassName}>{tile.label}</span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
