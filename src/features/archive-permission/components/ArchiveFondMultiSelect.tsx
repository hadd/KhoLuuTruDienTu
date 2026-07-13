import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ArchiveFondT } from '@/features/archive-fond/types'
import { cn } from '@/lib/utils/cn'

interface ArchiveFondMultiSelectProps {
  fonds: Array<ArchiveFondT>
  isLoading?: boolean
  value: Array<string>
  onValueChange: (value: Array<string>) => void
  disabled?: boolean
  placeholder?: string
}

export function ArchiveFondMultiSelect({
  fonds,
  isLoading = false,
  value,
  onValueChange,
  disabled,
  placeholder,
}: ArchiveFondMultiSelectProps) {
  const { t } = useTranslation('archive-permission')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFonds = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return fonds
    return fonds.filter(
      (fond) =>
        fond.id.toLowerCase().includes(normalized) ||
        fond.fondName.toLowerCase().includes(normalized),
    )
  }, [fonds, searchQuery])

  const selectedFonds = useMemo(
    () =>
      value
        .map((fondId) => fonds.find((item) => item.id === fondId))
        .filter((fond): fond is ArchiveFondT => Boolean(fond)),
    [fonds, value],
  )

  const triggerLabel = useMemo(() => {
    if (value.length === 0) {
      return placeholder ?? t('slot.fondsPlaceholder')
    }
    if (value.length === 1) {
      const fond = selectedFonds[0]
      return fond ? `${fond.id} — ${fond.fondName}` : value[0]
    }
    return t('slot.fondsSelectedCount', { count: value.length })
  }, [placeholder, selectedFonds, t, value])

  const toggleFond = (fondId: string) => {
    if (value.includes(fondId)) {
      onValueChange(value.filter((id) => id !== fondId))
      return
    }
    onValueChange([...value, fondId])
  }

  const removeFond = (fondId: string) => {
    onValueChange(value.filter((id) => id !== fondId))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
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
            disabled={disabled || isLoading}
            className="h-9 w-full justify-between font-normal"
          >
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-left',
                value.length === 0 && 'text-muted-foreground',
              )}
            >
              {triggerLabel}
            </span>
            {isLoading ? (
              <Loader2 className="size-4 shrink-0 animate-spin opacity-60" />
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 size-4 shrink-0 opacity-50" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('slot.fondsPlaceholder')}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredFonds.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                {t('slot.fondsEmpty')}
              </p>
            ) : (
              filteredFonds.map((fond) => {
                const selected = value.includes(fond.id)
                return (
                  <button
                    key={fond.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                      selected && 'bg-accent/60',
                    )}
                    onClick={() => toggleFond(fond.id)}
                  >
                    <Check
                      className={cn(
                        'size-4 shrink-0',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">
                      {fond.id} — {fond.fondName}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedFonds.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedFonds.map((fond) => (
            <Badge
              key={fond.id}
              variant="secondary"
              className="max-w-full gap-1 font-normal"
            >
              <span className="truncate">
                {fond.id} — {fond.fondName}
              </span>
              <button
                type="button"
                className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
                aria-label={t('slot.removeFond', { name: fond.fondName })}
                disabled={disabled}
                onClick={() => removeFond(fond.id)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
