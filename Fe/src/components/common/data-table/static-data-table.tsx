import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import { cn } from '@/lib/utils/cn'

import { DataTable } from './data-table'

interface StaticDataTableProps<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>
  data: Array<TData>
  isLoading?: boolean
  emptyMessage?: string
  className?: string
  showRowNumber?: boolean
  /** Optional pre-filtered data search string, handled by caller */
  search?: string
  /** How to stringify a row for client-side filtering when search is provided */
  getSearchText?: (row: TData) => string
}

export function StaticDataTable<TData, TValue>({
  columns,
  data,
  isLoading,
  emptyMessage,
  className,
  showRowNumber,
  search,
  getSearchText,
}: StaticDataTableProps<TData, TValue>) {
  const normalizedSearch = search?.trim().toLowerCase() ?? ''

  const filterFn =
    getSearchText ??
    ((row: TData) => {
      try {
        return JSON.stringify(row)
      } catch {
        return String(row)
      }
    })

  const filteredData = useMemo(() => {
    if (!normalizedSearch) return data
    return data.filter((row) =>
      filterFn(row).toLowerCase().includes(normalizedSearch),
    )
  }, [data, normalizedSearch, filterFn])

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        showRowNumber={showRowNumber}
        className="flex-1 w-full"
      />
    </div>
  )
}
