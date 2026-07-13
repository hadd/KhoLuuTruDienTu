import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <div className="flex flex-col gap-1.5">
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
            className="h-auto min-h-9 w-full justify-between font-normal"
          >
            <div className="flex flex-1 flex-wrap gap-1 py-0.5">
              {value.length === 0 ? (
                <span className="text-muted-foreground">
                  {placeholder ?? t('slot.fondsPlaceholder')}
                </span>
              ) : (
                value.map((fondId) => {
                  const fond = fonds.find((item) => item.id === fondId)
                  return (
                    <Badge
                      key={fondId}
                      variant="secondary"
                      className="gap-1"
                      onClick={(event) => {
                        event.stopPropagation()
                        removeFond(fondId)
                      }}
                    >
                      {fond ? `${fond.id} — ${fond.fondName}` : fondId}
                      <X className="size-3" />
                    </Badge>
                  )
                })
              )}
            </div>
            {isLoading ? (
              <Loader2 className="size-4 shrink-0 animate-spin opacity-60" />
            ) : (
              <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
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
                {t('slot.fondsPlaceholder')}
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
      {value.length > 0 ? (
        <Label className="text-xs font-normal text-muted-foreground">
          {value.length}
        </Label>
      ) : null}
    </div>
  )
}
