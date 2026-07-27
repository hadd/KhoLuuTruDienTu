import type { LucideIcon } from 'lucide-react'

import {
  WarehouseIconTile,
  WarehouseIconTileGrid,
} from '@/features/warehouse-management/components/WarehouseIconTile'

export type ArchiveWarehouseCatalogItemT = {
  id: string
  name: string
  description?: string
}

type ArchiveWarehouseCatalogGridProps = {
  items: Array<ArchiveWarehouseCatalogItemT>
  selectedId?: string
  emptyMessage: string
  icon: LucideIcon
  onSelect: (id: string) => void
}

export function ArchiveWarehouseCatalogGrid({
  items,
  selectedId,
  emptyMessage,
  icon: Icon,
  onSelect,
}: ArchiveWarehouseCatalogGridProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <WarehouseIconTileGrid>
      {items.map((item) => (
        <WarehouseIconTile
          key={item.id}
          icon={Icon}
          label={item.name}
          description={item.description}
          selected={item.id === selectedId}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </WarehouseIconTileGrid>
  )
}
