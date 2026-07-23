import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

export type ArchiveWarehouseCatalogItemT = {
  id: string
  name: string
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const selected = item.id === selectedId
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={selectedId ? selected : undefined}
            className={cn(
              'flex flex-col items-center gap-2 p-2 text-center transition-colors',
              'hover:text-primary',
              selected && 'text-primary',
            )}
          >
            <span
              className={cn(
                'flex size-14 items-center justify-center text-muted-foreground',
                selected && 'text-primary',
              )}
            >
              <Icon className="size-7" aria-hidden />
            </span>
            <span
              className={cn(
                'line-clamp-2 w-full text-sm font-medium text-foreground',
                selected && 'text-primary',
              )}
            >
              {item.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
