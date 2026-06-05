import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'

import type { UserT } from '@/features/auth/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

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
  const userById = (id: string) => users.find((u) => u.id === id)
  const isInteractionDisabled = disabled || isLoading || readOnly

  return (
    <div className="flex flex-col space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
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
                  if (!user) return null
                  return (
                    <Badge key={id} variant="secondary" className="font-normal">
                      {user.fullName}
                    </Badge>
                  )
                })
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[400px] p-0" align="start">
          <div className="max-h-60 overflow-y-auto p-1 space-y-1">
            {isLoading ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{loadingLabel}</p>
            ) : users.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              users.map((user) => {
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
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{user.fullName}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center border rounded-sm border-primary transition-all',
                        isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50',
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
