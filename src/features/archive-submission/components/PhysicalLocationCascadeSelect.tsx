import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getArchivePhysicalLocationBoxes } from '@/features/archive-submission/api/archiveSubmissionClient'
import { cn } from '@/lib/utils/cn'

interface PhysicalLocationCascadeSelectProps {
  value?: string
  onValueChange: (value: string) => void
  disabled?: boolean
  /** When true (default), only shows boxes with free capacity. */
  availableOnly?: boolean
}

export function PhysicalLocationCascadeSelect({
  value = '',
  onValueChange,
  disabled = false,
  availableOnly = true,
}: PhysicalLocationCascadeSelectProps) {
  const { t } = useTranslation('archive-submission')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const boxesQuery = useQuery({
    queryKey: [
      'archive-physical-location-boxes',
      availableOnly ? 'available' : 'all',
    ],
    queryFn: () => getArchivePhysicalLocationBoxes({ availableOnly }),
    staleTime: 15_000,
  })

  const boxes = boxesQuery.data ?? []
  const selected = boxes.find((box) => box.id === value)

  const filteredBoxes = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return boxes
    return boxes.filter(
      (box) =>
        box.breadcrumb.toLowerCase().includes(normalized) ||
        box.name.toLowerCase().includes(normalized),
    )
  }, [boxes, searchQuery])

  function optionLabel(box: (typeof boxes)[number]): string {
    if (box.capacity != null) {
      return `${box.breadcrumb} (${box.usedCapacity}/${box.capacity})`
    }
    return box.breadcrumb
  }

  if (boxesQuery.isPending) {
    return <p className="text-sm text-muted-foreground">{t('form.loading')}</p>
  }

  if (boxesQuery.isError) {
    return (
      <p className="text-sm text-destructive">{t('form.loadFailed')}</p>
    )
  }

  if (boxes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('physicalLocation.noBoxes')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearchQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-10 w-full justify-between py-2 text-left font-normal hover:bg-background"
            disabled={disabled || boxesQuery.isPending}
          >
            {selected ? (
              <span className="line-clamp-2 break-all text-foreground">
                {optionLabel(selected)}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t('physicalLocation.selectBox')}
              </span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onWheel={(event) => event.stopPropagation()}
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('physicalLocation.searchBox')}
                className="pl-8"
                disabled={disabled}
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {boxesQuery.isFetching ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('form.loading')}
              </div>
            ) : filteredBoxes.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                {t('physicalLocation.emptyStep')}
              </p>
            ) : (
              filteredBoxes.map((box) => {
                const isSelected = box.id === value
                return (
                  <button
                    key={box.id}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent',
                    )}
                    onClick={() => {
                      onValueChange(box.id)
                      setOpen(false)
                      setSearchQuery('')
                    }}
                  >
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-all font-medium">
                        {box.name}
                      </span>
                      <span className="mt-0.5 block break-all text-xs text-muted-foreground">
                        {box.breadcrumb}
                        {box.capacity != null
                          ? ` · ${box.usedCapacity}/${box.capacity}`
                          : ''}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected ? (
        <p className="break-all text-xs text-muted-foreground">
          {t('physicalLocation.pathLabel')}: {selected.breadcrumb}
        </p>
      ) : null}
    </div>
  )
}
