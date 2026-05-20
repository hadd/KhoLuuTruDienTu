import type { UseQueryOptions } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import * as React from 'react'
import { useDeferredValue } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'

/**
 * Generic search select component props
 *
 * @template T - The type of items in the select options
 */
export interface SearchSelectProps<T> {
  /**
   * Current selected value (item ID)
   */
  value?: string | null
  /**
   * Callback when value changes
   */
  onChange?: (value: string | null) => void
  /**
   * TanStack Query options for fetching data
   * Should accept search parameter and return items array
   */
  queryOptions: (
    search?: string,
  ) => UseQueryOptions<{ items: Array<T> } | undefined>
  /**
   * Function to get the unique ID from an item
   */
  getOptionValue: (item: T) => string
  /**
   * Function to get the display label from an item (for trigger button)
   */
  getOptionLabel: (item: T) => string
  /**
   * Optional function to get custom display content for items in the list
   * If not provided, uses getOptionLabel
   */
  getOptionDisplay?: (item: T) => React.ReactNode
  /**
   * Placeholder text for the trigger button
   */
  placeholder?: string
  /**
   * Placeholder text for the search input
   */
  searchPlaceholder?: string
  /**
   * Message to show when no results found
   */
  emptyMessage?: string
  /**
   * Whether the select is disabled
   */
  disabled?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Array of IDs to exclude from the options
   */
  excludeIds?: Array<string>
  /**
   * Whether to allow clearing the selection (clicking selected item deselects it)
   */
  allowClear?: boolean
  /**
   * i18n namespace for translations
   */
  namespace?: string
}

/**
 * SearchSelect - Generic searchable select component
 *
 * This component provides a reusable pattern for searchable select inputs.
 * It handles data fetching, search debouncing, and selection logic.
 *
 * @example
 * // ✅ Correct - Use with query options
 * <SearchSelect
 *   queryOptions={(search) => teachersQueryOptions(schoolId, { search })}
 *   getOptionValue={(t) => t.id}
 *   getOptionLabel={(t) => t.name}
 *   value={value}
 *   onChange={setValue}
 * />
 *
 * @example
 * // ✅ Correct - Use factory helper (preferred)
 * const TeacherSelect = createTeacherSearchSelect()
 * <TeacherSelect value={value} onChange={setValue} />
 *
 * @example
 * // ❌ Wrong - Don't create custom search select components
 * // Use SearchSelect or factory helpers instead
 */
export function SearchSelect<T>({
  value,
  onChange,
  queryOptions: getQueryOptions,
  getOptionValue,
  getOptionLabel,
  getOptionDisplay,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  className,
  excludeIds = [],
  allowClear = true,
  namespace = 'school',
}: SearchSelectProps<T>) {
  const { t } = useTranslation(namespace)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const debouncedSearch = useDeferredValue(search)

  // Get query options with search parameter
  const queryOptions = React.useMemo(
    () => getQueryOptions(debouncedSearch.trim() || undefined),
    [getQueryOptions, debouncedSearch],
  )

  const { data, isLoading } = useQuery(queryOptions)

  const items = React.useMemo(() => {
    const allItems = data?.items ?? []
    return allItems.filter((item) => !excludeIds.includes(getOptionValue(item)))
  }, [data?.items, excludeIds, getOptionValue])

  const selected = React.useMemo(
    () => items.find((item) => getOptionValue(item) === value) ?? null,
    [items, value, getOptionValue],
  )

  const handleSelect = (id: string) => {
    if (allowClear && id === value) {
      onChange?.(null)
    } else {
      onChange?.(id)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            // min-w-0 + shrink: allow co inside flex/grid (Button base uses shrink-0)
            'h-auto min-h-10 w-full min-w-0 max-w-full shrink justify-between gap-2 overflow-hidden',
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? (
              getOptionLabel(selected)
            ) : (
              <span className="text-muted-foreground">
                {placeholder ??
                  t('common.selectPlaceholder', {
                    defaultValue: 'Select...',
                  })}
              </span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              searchPlaceholder ??
              t('common.searchPlaceholder', {
                defaultValue: 'Search...',
              })
            }
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {emptyMessage ??
                    t('common.noResults', {
                      defaultValue: 'No results found',
                    })}
                </CommandEmpty>
                <CommandGroup>
                  {items.map((item) => {
                    const itemValue = getOptionValue(item)
                    const isSelected = itemValue === value
                    return (
                      <CommandItem
                        key={itemValue}
                        value={itemValue}
                        className="min-w-0"
                        onSelect={() => handleSelect(itemValue)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            isSelected ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <div className="min-w-0 flex-1 overflow-hidden text-left">
                          {getOptionDisplay ? (
                            <div className="truncate">{getOptionDisplay(item)}</div>
                          ) : (
                            <span className="block truncate">
                              {getOptionLabel(item)}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
