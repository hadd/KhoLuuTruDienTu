import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'
import type {
  WarehouseBrowseSortDirectionT,
  WarehouseDossierBrowseSortFieldT,
} from '@/features/archive-warehouse/lib/warehouseBrowseSort'
import { cn } from '@/lib/utils/cn'

type ArchiveWarehouseSortableTableHeadProps = {
  label: string
  field: WarehouseDossierBrowseSortFieldT
  sortBy?: WarehouseDossierBrowseSortFieldT
  sortDir?: WarehouseBrowseSortDirectionT
  onSortChange: (field: WarehouseDossierBrowseSortFieldT) => void
  className?: string
}

export function ArchiveWarehouseSortableTableHead({
  label,
  field,
  sortBy,
  sortDir,
  onSortChange,
  className,
}: ArchiveWarehouseSortableTableHeadProps) {
  const isActive = sortBy === field

  return (
    <TableHead className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 px-2 font-medium text-foreground hover:text-foreground"
        onClick={() => onSortChange(field)}
      >
        <span>{label}</span>
        {isActive ? (
          sortDir === 'desc' ? (
            <ArrowDown className="ml-1.5 size-3.5" aria-hidden />
          ) : (
            <ArrowUp className="ml-1.5 size-3.5" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="ml-1.5 size-3.5 opacity-40" aria-hidden />
        )}
      </Button>
    </TableHead>
  )
}
