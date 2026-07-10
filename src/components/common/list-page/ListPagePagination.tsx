import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ListPagePaginationProps {
  page: number
  totalPages: number
  limit: number
  pageSizeOptions: ReadonlyArray<number>
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

export function ListPagePagination({
  page,
  totalPages,
  limit,
  pageSizeOptions,
  onPageChange,
  onLimitChange,
}: ListPagePaginationProps) {
  const { t } = useTranslation('common')
  const safePage = Math.min(Math.max(page, 1), totalPages)

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t('table.pagination.rowsPerPage')}
          </span>
          <Select
            value={String(limit)}
            onValueChange={(value) => onLimitChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
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
        <p className="text-sm text-muted-foreground">
          {t('table.pagination.status')} {safePage} / {totalPages}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          {t('table.pagination.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          {t('table.pagination.next')}
        </Button>
      </div>
    </div>
  )
}
