import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

export type MetadataSearchableOption = {
  value: string
  label: string
}

export type MetadataSearchableSelectProps = {
  options: MetadataSearchableOption[]
  value: string
  onValueChange?: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  noResultsText: string
  disabled?: boolean
  className?: string
  displayLabel?: string
}

function matchesOptionLabel(label: string, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return label.toLowerCase().includes(normalized)
}

export function MetadataSearchableSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  noResultsText,
  disabled = false,
  className,
  displayLabel,
}: MetadataSearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        matchesOptionLabel(option.label, searchQuery),
      ),
    [options, searchQuery],
  )

  const triggerLabel =
    displayLabel ?? selectedOption?.label ?? (value.trim() ? value : '')

  function selectOption(nextValue: string) {
    onValueChange?.(nextValue)
    setOpen(false)
    setSearchQuery('')
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (filteredOptions.length !== 1) return
    selectOption(filteredOptions[0].value)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearchQuery('')
          return
        }
        requestAnimationFrame(() => searchInputRef.current?.focus())
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-auto min-h-10 w-full min-w-0 justify-between overflow-hidden py-2 text-left font-normal hover:bg-background',
            className,
          )}
        >
          {triggerLabel ? (
            <span className="block min-w-0 max-w-full flex-1 truncate text-foreground">
              {triggerLabel}
            </span>
          ) : (
            <span className="block min-w-0 max-w-full flex-1 truncate text-muted-foreground">
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="min-w-[var(--radix-popover-trigger-width)] w-[min(36rem,calc(100vw-2rem))] p-0"
        align="end"
        onWheel={(event) => event.stopPropagation()}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              className="pl-8"
              disabled={disabled}
            />
          </div>
        </div>

        <div
          className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-1"
          onWheel={(event) => event.stopPropagation()}
        >
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {options.length === 0 ? emptyText : noResultsText}
            </p>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'flex w-full items-start justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    isSelected && 'bg-muted/60',
                  )}
                  onClick={() => selectOption(option.value)}
                >
                  <span className="min-w-0 flex-1 whitespace-normal break-words font-medium text-foreground">
                    {option.label}
                  </span>
                  <div
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary transition-all',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'opacity-50',
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
