import type {
  ColumnDef,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/common/EmptyState'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils/cn'

import { DataTablePagination } from './data-table-pagination'

interface DataTableProps<TData, TValue> {
  columns: Array<ColumnDef<TData, TValue>>
  data: Array<TData>
  isLoading?: boolean
  pagination?: PaginationState
  onPaginationChange?: (pagination: PaginationState) => void
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  emptyMessage?: string
  className?: string
  pageCount?: number
  total?: number
  showRowNumber?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  emptyMessage,
  className,
  pageCount,
  total,
  showRowNumber = true,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation('common')

  // Use translated default empty message if not provided
  const translatedEmptyMessage = emptyMessage || t('table.emptyMessage')

  // Add row number column if enabled
  const columnsWithRowNumber = useMemo(() => {
    if (!showRowNumber) {
      return columns
    }

    const rowNumberColumn: ColumnDef<TData, TValue> = {
      id: 'rowNumber',
      header: () => (
        <div className="text-left pl-2">
          {t('table.rowNumber', { defaultValue: '#' })}
        </div>
      ),
      cell: ({ row }) => {
        const rowNumber = pagination
          ? pagination.pageIndex * pagination.pageSize + row.index + 1
          : row.index + 1
        return (
          <div className="text-left pl-2 text-muted-foreground font-mono text-sm">
            {String(rowNumber).padStart(2, '0')}
          </div>
        )
      },
      size: 60,
      minSize: 60,
      enableSorting: false,
    }

    return [rowNumberColumn, ...columns]
  }, [columns, showRowNumber, pagination, t])

  const table = useReactTable({
    data,
    columns: columnsWithRowNumber,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pagination || onPaginationChange
      ? {
          getPaginationRowModel: getPaginationRowModel(),
        }
      : {}),
    manualPagination: !!pagination,
    manualSorting: !!sorting,
    state: {
      ...(pagination && { pagination }),
      ...(sorting && { sorting }),
    },
    ...(onPaginationChange && {
      onPaginationChange: (updater) => {
        const newPagination =
          typeof updater === 'function'
            ? updater(pagination || { pageIndex: 0, pageSize: 20 })
            : updater
        onPaginationChange(newPagination)
      },
    }),
    ...(onSortingChange && {
      onSortingChange: (updater) => {
        const newSorting =
          typeof updater === 'function' ? updater(sorting || []) : updater
        onSortingChange(newSorting)
      },
    }),
  })

  if (isLoading) {
    return (
      <div className={cn('flex flex-col flex-1 min-h-0 w-full', className)}>
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col flex-1 min-h-0  border border-border bg-card w-full',
          className,
        )}
      >
        <EmptyState
          message={translatedEmptyMessage}
          className="flex-1 min-h-0 border-none bg-transparent"
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 w-full', className)}>
      {/* Scrollable table container */}
      <div className="flex-1 overflow-auto min-h-0 relative w-full scrollbar-always-visible">
        <table
          className="w-full caption-bottom text-sm table-fixed"
          style={{ minWidth: table.getTotalSize() }}
        >
          <TableHeader className="sticky top-[-1px] z-30 bg-muted border-t border-b shadow-sm border-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted">
                {headerGroup.headers.map((header) => {
                  const isActions = header.column.id === 'actions'

                  // Extract alignment from cell definition to match header
                  const cellDef = header.column.columnDef.cell
                  let cellAlignment = ''
                  if (typeof cellDef === 'function') {
                    // Try to infer alignment from column meta or default based on column type
                    const meta = header.column.columnDef.meta as
                      | { alignment?: 'left' | 'right' | 'center' }
                      | undefined
                    if (meta?.alignment) {
                      cellAlignment = `text-${meta.alignment}`
                    }
                  }

                  // For actions column, always right align
                  const alignmentClass = isActions
                    ? 'text-right'
                    : cellAlignment

                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        right: isActions ? 0 : undefined,
                      }}
                      className={cn(
                        'bg-muted',
                        alignmentClass && !alignmentClass.includes('text-left'), // Don't override default left
                        isActions &&
                          'sticky z-40 shadow-[-1px_0_0_0_var(--color-border)]',
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className="group"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isActions = cell.column.id === 'actions'

                    // Extract alignment from column meta to ensure consistency
                    const meta = cell.column.columnDef.meta as
                      | { alignment?: 'left' | 'right' | 'center' }
                      | undefined
                    const alignmentClass = meta?.alignment
                      ? `text-${meta.alignment}`
                      : isActions
                        ? 'text-right'
                        : ''

                    return (
                      <TableCell
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          right: isActions ? 0 : undefined,
                        }}
                        className={cn(
                          alignmentClass &&
                            !alignmentClass.includes('text-left'), // Don't override default left
                          isActions &&
                            'sticky z-20 bg-background shadow-[-1px_0_0_0_var(--color-border)] group-hover:bg-muted group-data-[state=selected]:bg-muted',
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnsWithRowNumber.length}
                  className="h-24 text-center"
                >
                  {translatedEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      {/* Pagination footer */}
      {pagination && onPaginationChange && (
        <DataTablePagination
          pagination={pagination}
          onPaginationChange={onPaginationChange}
          pageCount={pageCount}
          total={total}
        />
      )}
    </div>
  )
}
