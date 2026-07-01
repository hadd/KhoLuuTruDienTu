import { ChevronsUpDown, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { Group } from '@/features/group/types'
import { cn } from '@/lib/utils/cn'

interface GroupToolbarProps {
  groups: Array<Group>
  activeGroup: Group | null
  searchQuery: string
  onSearchChange: (query: string) => void
  onSelectGroup: (groupId: string) => void
  onCreateGroup: () => void
}

export function GroupToolbar({
  groups,
  activeGroup,
  searchQuery,
  onSearchChange,
  onSelectGroup,
  onCreateGroup,
}: GroupToolbarProps) {
  const { t } = useTranslation('group')
  const [open, setOpen] = useState(false)

  const handleSelectGroup = (groupId: string) => {
    onSelectGroup(groupId)
    setOpen(false)
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-sm font-medium text-foreground">
          {t('sidebar.groupName')}
        </span>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-9 min-w-[180px] max-w-xs justify-between font-normal"
            >
              <span className="truncate">
                {activeGroup?.name ?? t('sidebar.empty')}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-72 p-0" align="start">
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder={t('search')}
                  className="h-9 pl-8"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                />
              </div>
            </div>

            <div className="max-h-[180px] overflow-y-auto p-1">
              {groups.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground italic">
                  {t('sidebar.empty')}
                </p>
              ) : (
                groups.map((group) => {
                  const isActive = activeGroup?.id === group.id

                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleSelectGroup(group.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-muted/80',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {group.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t('createDialog.fields.roundNumber.option', {
                          level: group.roundNumber ?? 0,
                        })}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Button type="button" className="shrink-0" onClick={onCreateGroup}>
        <Plus className="mr-2 size-4" />
        {t('createGroup')}
      </Button>
    </div>
  )
}
