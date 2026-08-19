import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils/cn'

type ArchiveWarehouseDropdownFilterTableHeadProps = {
  label: string
  field: string
  options: { id: string; label: string }[]
  selectedValues?: string | string[] | null
  onChange: (next: string | undefined) => void
  onSortChange?: (dir: 'asc' | 'desc' | null) => void
  sortBy?: 'asc' | 'desc' | null
  className?: string
}

export function ArchiveWarehouseDropdownFilterTableHead({
  label,
  options,
  selectedValues,
  onChange,
  onSortChange,
  sortBy,
  className,
}: ArchiveWarehouseDropdownFilterTableHeadProps) {
  const selectedArray = Array.isArray(selectedValues)
    ? selectedValues
    : selectedValues
      ? selectedValues.split(',')
      : []

  return (
    <TableHead className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              '-ml-3 h-8 px-2 font-medium text-foreground hover:text-foreground',
              selectedArray.length > 0 && 'bg-accent',
            )}
          >
            <span>{label}</span>
            {sortBy === 'desc' ? (
              <ArrowDown className="ml-1.5 size-3.5" aria-hidden />
            ) : sortBy === 'asc' ? (
              <ArrowUp className="ml-1.5 size-3.5" aria-hidden />
            ) : selectedArray.length > 0 ? (
              <Filter className="ml-1.5 size-3.5" aria-hidden />
            ) : (
              <ArrowUpDown className="ml-1.5 size-3.5 opacity-40" aria-hidden />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[300px] w-48 overflow-y-auto">
          {onSortChange ? (
            <>
              <DropdownMenuLabel>Sắp xếp</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sortBy ?? ''}
                onValueChange={(val) => onSortChange(val as 'asc' | 'desc' | null)}
              >
                <DropdownMenuRadioItem value="asc">Tăng dần</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">Giảm dần</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel>Lọc theo</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onChange(undefined)}>
            Tất cả
          </DropdownMenuItem>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={selectedArray.includes(option.id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange(option.id)
                } else {
                  onChange(undefined)
                }
              }}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  )
}
