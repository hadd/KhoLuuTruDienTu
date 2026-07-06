import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
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
import type { UserT } from '@/features/auth/types'
import { cn } from '@/lib/utils/cn'

function matchesUserSearch(user: UserT, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    user.fullName.toLowerCase().includes(normalized) ||
    user.email.toLowerCase().includes(normalized)
  )
}

export interface UserMultiSelectFieldProps {
  label: string
  placeholder: string
  selectedLabel: string
  emptyLabel: string
  loadingLabel: string
  users: Array<UserT>
  isLoading: boolean
  selectedIds: Array<string>
  onToggle: (userId: string) => void
  disabled?: boolean
  readOnly?: boolean
  hint?: string
}

export function UserMultiSelectField({
  label,
  placeholder,
  selectedLabel,
  emptyLabel,
  loadingLabel,
  users,
  isLoading,
  selectedIds,
  onToggle,
  disabled,
  readOnly,
  hint,
}: UserMultiSelectFieldProps) {
  const { t } = useTranslation('group')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const userById = (id: string) => users.find((u) => u.id === id)
  const isInteractionDisabled = disabled || isLoading || readOnly

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesUserSearch(user, searchQuery)),
    [searchQuery, users],
  )

  return (
    <div className="flex flex-col space-y-2">
      <Label>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearchQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2"
            disabled={isInteractionDisabled}
          >
            <div className="flex flex-wrap gap-1 max-w-[90%]">
              {isLoading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingLabel}
                </span>
              ) : selectedIds.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedIds.map((id) => {
                  const user = userById(id)
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="font-normal cursor-pointer hover:opacity-80"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!readOnly && !isInteractionDisabled) onToggle(id)
                      }}
                    >
                      {user?.fullName ?? id}
                    </Badge>
                  )
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[400px] p-0"
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
                placeholder={t('userMultiSelect.searchPlaceholder')}
                className="pl-8"
                disabled={isInteractionDisabled}
                autoFocus
              />
            </div>
          </div>

          <div
            className="max-h-60 overflow-y-auto overscroll-contain p-1 space-y-1"
            onWheel={(event) => event.stopPropagation()}
          >
            {isLoading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {loadingLabel}
              </p>
            ) : users.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {emptyLabel}
              </p>
            ) : filteredUsers.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {t('userMultiSelect.noSearchResults')}
              </p>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm transition-colors text-left hover:bg-muted',
                      isSelected && 'bg-muted/60',
                      readOnly && 'cursor-not-allowed opacity-60',
                    )}
                    onClick={() => {
                      if (!readOnly) onToggle(user.id)
                    }}
                    disabled={readOnly}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {user.fullName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center border rounded-sm border-primary transition-all',
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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {selectedIds.length > 0 && (
        <p className="text-sm text-muted-foreground">{selectedLabel}</p>
      )}
    </div>
  )
}
