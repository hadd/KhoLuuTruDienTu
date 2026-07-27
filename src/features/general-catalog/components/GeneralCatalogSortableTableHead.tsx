import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'
import type {
  CatalogSortDirectionT,
  CatalogTypeSortFieldT,
} from '@/features/general-catalog/lib/catalogListSort'
import { cn } from '@/lib/utils/cn'

type GeneralCatalogSortableTableHeadProps = {
  label: string
  field: CatalogTypeSortFieldT
  sortBy?: CatalogTypeSortFieldT
  sortDir?: CatalogSortDirectionT
  onSortChange: (field: CatalogTypeSortFieldT) => void
  className?: string
  align?: 'left' | 'center'
}

export function GeneralCatalogSortableTableHead({
  label,
  field,
  sortBy,
  sortDir,
  onSortChange,
  className,
  align = 'left',
}: GeneralCatalogSortableTableHeadProps) {
  const isActive = sortBy === field

  return (
    <TableHead className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          '-ml-3 h-8 px-2 font-medium text-foreground hover:text-foreground',
          align === 'center' && 'mx-auto -ml-0',
        )}
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
