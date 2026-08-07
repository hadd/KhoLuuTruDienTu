import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

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

export interface UserSingleSelectFieldProps {
  label: string
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  noResultsLabel: string
  loadingLabel: string
  users: Array<UserT>
  isLoading: boolean
  selectedId: string
  onSelect: (userId: string) => void
  disabled?: boolean
  readOnly?: boolean
  hint?: string
  id?: string
}

function matchesUserSearch(user: UserT, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return (
    user.fullName.toLowerCase().includes(normalized) ||
    user.email.toLowerCase().includes(normalized)
  )
}

export function UserSingleSelectField({
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  noResultsLabel,
  loadingLabel,
  users,
  isLoading,
  selectedId,
  onSelect,
  disabled,
  readOnly,
  hint,
  id,
}: UserSingleSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const selectedUser = users.find((user) => user.id === selectedId)
  const isInteractionDisabled = disabled || isLoading || readOnly

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesUserSearch(user, searchQuery)),
    [searchQuery, users],
  )

  return (
    <div className="flex flex-col space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setSearchQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal hover:bg-background text-left min-h-10 h-auto py-2 px-3"
            disabled={isInteractionDisabled}
          >
            {isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingLabel}
              </span>
            ) : selectedUser ? (
              <span className="truncate text-foreground">
                {selectedUser.fullName}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
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
                placeholder={searchPlaceholder}
                className="pl-8"
                disabled={isInteractionDisabled}
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
                {noResultsLabel}
              </p>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedId === user.id
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
                      if (readOnly) return
                      onSelect(user.id)
                      setOpen(false)
                      setSearchQuery('')
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
                        'ml-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary transition-all',
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
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
