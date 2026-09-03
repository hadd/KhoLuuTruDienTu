import { useNavigate } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ArchiveWarehouseDossierItemT } from '@/features/archive-warehouse/types'
import { searchPhysicalWarehouse } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { buildNavigateSearchFromPlacement } from '@/features/physical-warehouse/lib/physicalWarehouseSearchNav'

interface ArchiveWarehousePhysicalPlacementBadgeProps {
  item: ArchiveWarehouseDossierItemT
}

export function ArchiveWarehousePhysicalPlacementBadge({
  item,
}: ArchiveWarehousePhysicalPlacementBadgeProps) {
  const { t } = useTranslation('archive-warehouse')
  const navigate = useNavigate()

  if (!item.hasPhysicalPlacement) {
    return (
      <Badge variant="secondary" className="font-normal">
        {t('table.physicalUnplaced')}
      </Badge>
    )
  }

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await searchPhysicalWarehouse({
        dossierName: item.name,
        limit: 10,
      })
      const hit = res.items.find(
        (h) => h.entityId === item.id && h.physicalPlacement != null,
      )
      if (hit?.physicalPlacement) {
        const navPatch = buildNavigateSearchFromPlacement({
          physicalItemId: hit.physicalPlacement.physicalItemId,
          ancestorIds: hit.physicalPlacement.ancestorIds,
          dossierId: hit.entityId,
          dossierTitle: hit.title,
          placementBreadcrumb: hit.physicalPlacement.breadcrumb,
        })
        if (navPatch) {
          void navigate({
            to: '/app/physical-warehouse',
            search: navPatch as any,
          })
          return
        }
      }
    } catch {
      // Fallback below
    }

    void navigate({
      to: '/app/physical-warehouse',
      search: { q: item.name } as any,
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 max-w-[200px] gap-1 px-2 text-xs font-normal hover:border-primary hover:text-primary shrink-0"
      title="Xem vị trí trong sơ đồ kho vật lý"
      onClick={handleClick}
    >
      <MapPin className="size-3.5 text-primary shrink-0" aria-hidden />
      <span className="truncate">
        {item.physicalBoxName ?? 'Ô chứa'}
      </span>
    </Button>
  )
}
