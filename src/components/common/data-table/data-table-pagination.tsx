import type { PaginationState } from '@tanstack/react-table'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DataTablePaginationProps {
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  pageCount?: number
  total?: number
  /** Defaults to 10, 20, 50, 100 */
  pageSizeOptions?: Array<number>
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export function DataTablePagination({
  pagination,
  onPaginationChange,
  pageCount = 0,
  total = 0,
  pageSizeOptions = [...DEFAULT_PAGE_SIZE_OPTIONS],
}: DataTablePaginationProps) {
  const { t } = useTranslation('common')
  const { pageIndex, pageSize } = pagination
  const currentPage = pageIndex + 1 // Convert 0-based to 1-based for display
  const totalPages = pageCount || Math.ceil(total / pageSize) || 1

  const startItem = total === 0 ? 0 : pageIndex * pageSize + 1
  const endItem = Math.min((pageIndex + 1) * pageSize, total)

  const canPreviousPage = pageIndex > 0
  const canNextPage = pageIndex < totalPages - 1

  const handlePreviousPage = () => {
    if (canPreviousPage) {
      onPaginationChange({
        ...pagination,
        pageIndex: pageIndex - 1,
      })
    }
  }

  const handleNextPage = () => {
    if (canNextPage) {
      onPaginationChange({
        ...pagination,
        pageIndex: pageIndex + 1,
      })
    }
  }

  const handlePageChange = (newPage: string) => {
    const page = Number(newPage)
    if (page >= 1 && page <= totalPages) {
      onPaginationChange({
        ...pagination,
        pageIndex: page - 1, // Convert 1-based to 0-based
      })
    }
  }

  const handlePageSizeChange = (newPageSize: string) => {
    onPaginationChange({
      pageIndex: 0, // Reset to first page when changing page size
      pageSize: Number(newPageSize),
    })
  }

  // Generate all page options for dropdown
  const pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1)

  // Helper to highlight numbers in text
  const highlightNumbers = (text: string) => {
    return text.split(/(\d+)/).map((part, i) => {
      if (/^\d+$/.test(part)) {
        return (
          <span key={i} className="font-semibold">
            {part}
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="flex items-center justify-between border-t h-14 px-2">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('table.pagination.rowsPerPage')}
          </span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {total > 0 && (
          <div className="text-sm text-muted-foreground">
            {highlightNumbers(
              t('table.pagination.showing', {
                start: startItem,
                end: endItem,
                total: total,
              }),
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('table.pagination.page')}
            </span>
            <Select
              value={String(currentPage)}
              onValueChange={handlePageChange}
            >
              <SelectTrigger className="h-8 w-[70px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto">
                {pagesToShow.map((page) => (
                  <SelectItem key={page} value={String(page)}>
                    {page}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {highlightNumbers(
                t('table.pagination.of', { total: totalPages }),
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={!canPreviousPage}
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">
              {t('table.pagination.goToPreviousPage')}
            </span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!canNextPage}
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">
              {t('table.pagination.goToNextPage')}
            </span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
