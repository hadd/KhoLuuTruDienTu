import { GripVertical, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ScanPageT } from '@/features/document-scan/types'
import { cn } from '@/lib/utils/cn'

interface ScanPageThumbnailProps {
  page: ScanPageT
  isSelected?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  onSelect: (pageId: string) => void
  onDelete: (pageId: string) => void
}

export function ScanPageThumbnail({
  page,
  isSelected = false,
  dragHandleProps,
  onSelect,
  onDelete,
}: ScanPageThumbnailProps) {
  const { t } = useTranslation('document-scan')

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-md border bg-card',
        isSelected ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onSelect(page.id)}
      >
        <img
          src={page.imageData}
          alt={page.name}
          className="aspect-[3/4] w-full object-cover"
        />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/90 px-2 py-1">
        <span className="truncate text-xs text-foreground">{page.name}</span>
        <div className="flex items-center gap-0.5">
          {dragHandleProps ? (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              {...dragHandleProps}
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSelect(page.id)}>
                {t('actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(page.id)}
              >
                {t('actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
