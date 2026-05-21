// import type { UseQueryOptions } from '@tanstack/react-query'
// import { skipToken, useQuery } from '@tanstack/react-query'
// import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react'
// import * as React from 'react'
// import { useDeferredValue } from 'react'
// import { useTranslation } from 'react-i18next'

// import { Button } from '@/components/ui/button'
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from '@/components/ui/command'
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover'
// import { cn } from '@/lib/utils/cn'

// /**
//  * Generic multi-select search select component props
//  *
//  * @template T - The type of items in the select options
//  */
// export interface SearchSelectMultiProps<T> {
//   /**
//    * Current selected values (array of item IDs)
//    */
//   value?: Array<string>
//   /**
//    * Callback when value changes
//    */
//   onValueChange?: (value: Array<string>) => void
//   /**
//    * TanStack Query options for fetching data
//    * Should accept search parameter and return items array
//    */
//   queryOptions: (
//     search?: string,
//   ) => UseQueryOptions<{ items: Array<T> } | undefined>
//   /**
//    * Function to get the unique ID from an item
//    */
//   getOptionValue: (item: T) => string
//   /**
//    * Function to get the display label from an item (for tags and list)
//    */
//   getOptionLabel: (item: T) => string
//   /**
//    * Optional function to get custom display content for items in the list
//    * If not provided, uses getOptionLabel
//    */
//   getOptionDisplay?: (item: T) => React.ReactNode
//   /**
//    * Placeholder text for the trigger button
//    */
//   placeholder?: string
//   /**
//    * Placeholder text for the search input
//    */
//   searchPlaceholder?: string
//   /**
//    * Message to show when no results found
//    */
//   emptyMessage?: string
//   /**
//    * Whether the select is disabled
//    */
//   disabled?: boolean
//   /**
//    * Additional CSS classes
//    */
//   className?: string
//   /**
//    * Array of IDs to exclude from the options
//    */
//   excludeIds?: Array<string>
//   /**
//    * i18n namespace for translations
//    */
//   namespace?: string
//   /**
//    * Whether to show selected items at the top of the list
//    */
//   showSelectedFirst?: boolean
// }

// /**
//  * SearchSelectMulti - Generic multi-select searchable select component
//  *
//  * This component provides a reusable pattern for multi-select searchable inputs.
//  * Selected items are displayed as tags in the trigger button.
//  *
//  * @example
//  * // ✅ Correct - Use with query options
//  * <SearchSelectMulti
//  *   queryOptions={(search) => studentsQueryOptions(schoolId, { search })}
//  *   getOptionValue={(s) => s.userId}
//  *   getOptionLabel={(s) => s.user?.fullName || s.fullName}
//  *   value={value}
//  *   onValueChange={setValue}
//  * />
//  *
//  * @example
//  * // ✅ Correct - Use factory helper (preferred)
//  * const StudentMultiSelect = createStudentMultiSelect()
//  * <StudentMultiSelect value={value} onValueChange={setValue} />
//  */
// export function SearchSelectMulti<T>({
//   value = [],
//   onValueChange,
//   queryOptions: getQueryOptions,
//   getOptionValue,
//   getOptionLabel,
//   getOptionDisplay,
//   placeholder,
//   searchPlaceholder,
//   emptyMessage,
//   disabled = false,
//   className,
//   excludeIds = [],
//   namespace = 'school',
//   showSelectedFirst = true,
// }: SearchSelectMultiProps<T>) {
//   const { t } = useTranslation(namespace)
//   const [open, setOpen] = React.useState(false)
//   const [search, setSearch] = React.useState('')

//   const debouncedSearch = useDeferredValue(search)

//   // Get query options with search parameter
//   const queryOptions = React.useMemo(
//     () => getQueryOptions(debouncedSearch.trim() || undefined),
//     [getQueryOptions, debouncedSearch],
//   )

//   const { data, isLoading } = useQuery(queryOptions)

//   const items = React.useMemo(() => {
//     const allItems = data?.items ?? []
//     return allItems.filter((item) => !excludeIds.includes(getOptionValue(item)))
//   }, [data?.items, excludeIds, getOptionValue])

//   const selectedItems = React.useMemo(
//     () => items.filter((item) => value.includes(getOptionValue(item))),
//     [items, value, getOptionValue],
//   )

//   // Sort items: selected first if showSelectedFirst is true
//   const sortedItems = React.useMemo(() => {
//     if (!showSelectedFirst) return items

//     return [...items].sort((a, b) => {
//       const aSelected = value.includes(getOptionValue(a))
//       const bSelected = value.includes(getOptionValue(b))
//       if (aSelected === bSelected) {
//         // If both have same selection state, sort by label
//         return getOptionLabel(a).localeCompare(getOptionLabel(b))
//       }
//       return aSelected ? -1 : 1
//     })
//   }, [items, value, getOptionValue, getOptionLabel, showSelectedFirst])

//   const handleToggle = (id: string) => {
//     const newValue = value.includes(id)
//       ? value.filter((v) => v !== id)
//       : [...value, id]
//     onValueChange?.(newValue)
//   }

//   const handleRemove = (id: string, e: React.MouseEvent) => {
//     e.stopPropagation()
//     onValueChange?.(value.filter((v) => v !== id))
//   }

//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger asChild>
//         <Button
//           variant="outline"
//           role="combobox"
//           aria-expanded={open}
//           disabled={disabled}
//           className={cn('w-full justify-between min-h-10 h-auto', className)}
//         >
//           <div className="flex flex-wrap gap-1 flex-1">
//             {selectedItems.length > 0 ? (
//               selectedItems.map((item) => {
//                 const itemValue = getOptionValue(item)
//                 return (
//                   <span
//                     key={itemValue}
//                     className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
//                   >
//                     {getOptionLabel(item)}
//                     <X
//                       className="h-3 w-3 cursor-pointer hover:opacity-70"
//                       onClick={(e) => handleRemove(itemValue, e)}
//                     />
//                   </span>
//                 )
//               })
//             ) : (
//               <span className="text-muted-foreground">
//                 {placeholder ??
//                   t('common.selectPlaceholder', {
//                     defaultValue: 'Select...',
//                   })}
//               </span>
//             )}
//           </div>
//           <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent
//         className="w-[var(--radix-popover-trigger-width)] p-0"
//         align="start"
//       >
//         <Command shouldFilter={false}>
//           <CommandInput
//             placeholder={
//               searchPlaceholder ??
//               t('common.searchPlaceholder', {
//                 defaultValue: 'Search...',
//               })
//             }
//             value={search}
//             onValueChange={setSearch}
//           />
//           <CommandList>
//             {isLoading ? (
//               <div className="flex items-center justify-center py-6">
//                 <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
//               </div>
//             ) : (
//               <>
//                 <CommandEmpty>
//                   {emptyMessage ??
//                     t('common.noResults', {
//                       defaultValue: 'No results found',
//                     })}
//                 </CommandEmpty>
//                 <CommandGroup>
//                   {sortedItems.map((item) => {
//                     const itemValue = getOptionValue(item)
//                     const isSelected = value.includes(itemValue)
//                     return (
//                       <CommandItem
//                         key={itemValue}
//                         value={itemValue}
//                         onSelect={() => handleToggle(itemValue)}
//                       >
//                         <Check
//                           className={cn(
//                             'mr-2 h-4 w-4',
//                             isSelected ? 'opacity-100' : 'opacity-0',
//                           )}
//                         />
//                         {getOptionDisplay ? (
//                           getOptionDisplay(item)
//                         ) : (
//                           <span className="truncate">
//                             {getOptionLabel(item)}
//                           </span>
//                         )}
//                       </CommandItem>
//                     )
//                   })}
//                 </CommandGroup>
//               </>
//             )}
//           </CommandList>
//         </Command>
//       </PopoverContent>
//     </Popover>
//   )
// }
