import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ImageIcon,
  LayoutGrid,
  MapPin,
  Package,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getPhysicalWarehouseItem } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import { LocationManageTable } from '@/features/physical-warehouse/components/LocationManageTable'
import { WarehouseManageTable } from '@/features/physical-warehouse/components/WarehouseManageTable'
import { usePhysicalWarehouseAccess } from '@/features/physical-warehouse/hooks/usePhysicalWarehouseAccess'
import {
  physicalWarehouseItemsQueryOptions,
  physicalWarehouseQueryKeyPrefix,
} from '@/features/physical-warehouse/queries'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'

function getItemTypeLabel(
  item: PhysicalWarehouseItemT,
  t: (key: string) => string,
): string {
  if (item.parentId == null) return t('manage.locationLabel')
  return t('manage.warehouseLabel')
}

function isClickableAtRoot(item: PhysicalWarehouseItemT): boolean {
  return item.parentId == null
}

function isClickableWhenDrilledIn(item: PhysicalWarehouseItemT): boolean {
  return item.parentId != null
}

interface LocationListPanelProps {
  parentId?: string
  onNavigateToItem: (item: PhysicalWarehouseItemT) => void
  onNavigateBack: () => void
}

export function LocationListPanel({
  parentId,
  onNavigateToItem,
  onNavigateBack,
}: LocationListPanelProps) {
  const { t } = useTranslation('physical-warehouse')
  const { canManageLocations, canManageWarehouses } = usePhysicalWarehouseAccess()
  const isDrilledIn = Boolean(parentId)
  const [showManageTable, setShowManageTable] = useState(false)
  const [showWarehouseManageTable, setShowWarehouseManageTable] = useState(false)

  const { data: items = [], isPending } = useQuery(
    physicalWarehouseItemsQueryOptions(isDrilledIn ? parentId : undefined),
  )

  const { data: currentFolder } = useQuery({
    queryKey: [...physicalWarehouseQueryKeyPrefix, 'item', parentId] as const,
    queryFn: () => getPhysicalWarehouseItem(parentId!),
    enabled: isDrilledIn,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (!canManageLocations) setShowManageTable(false)
  }, [canManageLocations])

  useEffect(() => {
    if (!canManageWarehouses) setShowWarehouseManageTable(false)
  }, [canManageWarehouses])

  if (!isDrilledIn && showManageTable && canManageLocations) {
    return <LocationManageTable onBack={() => setShowManageTable(false)} />
  }

  if (isDrilledIn && parentId && showWarehouseManageTable && canManageWarehouses) {
    return (
      <WarehouseManageTable
        locationId={parentId}
        onBack={() => setShowWarehouseManageTable(false)}
      />
    )
  }

  const emptyMessage = isDrilledIn
    ? t('manage.empty')
    : t('locations.empty')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {isDrilledIn ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 h-8 px-2 text-muted-foreground"
              onClick={onNavigateBack}
            >
              <ArrowLeft className="mr-1 size-4" />
              {t('actions.backToLocations')}
            </Button>
          ) : null}
          <h2 className="text-base font-semibold">
            {isDrilledIn && currentFolder
              ? t('locations.insideLocation', { name: currentFolder.name })
              : t('locations.browseTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isDrilledIn
              ? t('locations.childrenDescription')
              : t('locations.browseDescription')}
          </p>
        </div>
        {canManageLocations && !isDrilledIn ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowManageTable(true)}
          >
            <LayoutGrid className="mr-1 size-4" />
            {t('locations.manageButton')}
          </Button>
        ) : null}
        {canManageWarehouses && isDrilledIn ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowWarehouseManageTable(true)}
          >
            <LayoutGrid className="mr-1 size-4" />
            {t('locations.manageWarehousesButton')}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <p className="text-sm text-muted-foreground">...</p>
      ) : items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{emptyMessage}</Card>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const imageSrc = item.imageDisplayUrl ?? item.imageUrl
            const childCount = item.childCount ?? 0
            const hasChildren = childCount > 0
            const clickable = isDrilledIn
              ? isClickableWhenDrilledIn(item)
              : isClickableAtRoot(item)
            const typeLabel = isDrilledIn
              ? t('manage.warehouseLabel')
              : getItemTypeLabel(item, t)
            const TypeIcon = item.parentId == null ? MapPin : Package

            return (
              <li
                key={item.id}
                className="group flex flex-col items-center text-center"
              >
                <div
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => {
                    if (clickable) onNavigateToItem(item)
                  }}
                  onKeyDown={(event) => {
                    if (!clickable) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onNavigateToItem(item)
                    }
                  }}
                  className={cn(
                    'flex w-full max-w-[11rem] flex-col items-center text-center',
                    clickable && 'cursor-pointer',
                    !clickable && 'cursor-default',
                  )}
                >
                  <div
                    className={cn(
                      'relative aspect-square w-full max-w-[11rem]',
                      'rounded-full',
                      'ring-1 ring-border/80',
                      'shadow-[0_10px_28px_-14px_rgba(15,23,42,0.35)]',
                      'transition-all duration-300',
                      clickable &&
                        'group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-primary/40',
                      clickable &&
                        'group-hover:shadow-[0_18px_36px_-16px_rgba(37,99,235,0.45)]',
                    )}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br from-muted via-muted to-muted/60">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.name}
                          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/15 via-muted to-background text-muted-foreground">
                          <TypeIcon className="size-8 text-primary/70" />
                          <ImageIcon className="size-4 opacity-40" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 w-full max-w-[11rem] px-1">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {item.name}
                    </p>
                    <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <TypeIcon className="size-3 shrink-0" />
                      <span>{typeLabel}</span>
                      {!isDrilledIn && hasChildren ? (
                        <span className="text-muted-foreground/70">
                          · {t('locations.warehouseCount', { count: childCount })}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
