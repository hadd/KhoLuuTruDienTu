// import { Check, ChevronsUpDown, X } from 'lucide-react'
// import * as React from 'react'
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
//  * Generic static data multi-select component props
//  *
//  * @template T - The type of items in the options array
//  */
// export interface StaticMultiSelectProps<T> {
//   /**
//    * Current selected values (array of option values)
//    */
//   value?: Array<string>
//   /**
//    * Callback when value changes
//    */
//   onValueChange?: (value: Array<string>) => void
//   /**
//    * Static array of options
//    */
//   options: Array<T>
//   /**
//    * Function to get the unique value from an item
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
//    * Array of values to exclude from the options
//    */
//   excludeIds?: Array<string>
//   /**
//    * Whether to show selected items at the top of the list
//    */
//   showSelectedFirst?: boolean
//   /**
//    * Custom client-side search filter function
//    * If not provided, defaults to label matching
//    */
//   searchFilter?: (item: T, search: string) => boolean
//   /**
//    * i18n namespace for translations
//    */
//   namespace?: string
// }

// /**
//  * Hook to filter out excluded items from options
//  */
// function useFilteredOptions<T>(
//   options: Array<T>,
//   excludeIds: Array<string>,
//   getOptionValue: (item: T) => string,
// ) {
//   return React.useMemo(() => {
//     return options.filter((item) => !excludeIds.includes(getOptionValue(item)))
//   }, [options, excludeIds, getOptionValue])
// }

// /**
//  * Hook to get selected items from filtered options
//  */
// function useSelectedItems<T>(
//   filteredOptions: Array<T>,
//   value: Array<string>,
//   getOptionValue: (item: T) => string,
// ) {
//   return React.useMemo(
//     () =>
//       filteredOptions.filter((item) => value.includes(getOptionValue(item))),
//     [filteredOptions, value, getOptionValue],
//   )
// }

// /**
//  * Hook to filter options based on search query
//  */
// function useSearchFilteredOptions<T>(
//   filteredOptions: Array<T>,
//   search: string,
//   value: Array<string>,
//   getOptionValue: (item: T) => string,
//   getOptionLabel: (item: T) => string,
//   searchFilter?: (item: T, search: string) => boolean,
// ) {
//   return React.useMemo(() => {
//     const q = search.trim().toLowerCase()
//     if (!q) return filteredOptions

//     const defaultFilter = (item: T, searchTerm: string) => {
//       const label = getOptionLabel(item).toLowerCase()
//       return label.includes(searchTerm)
//     }

//     const filter = searchFilter || defaultFilter
//     return filteredOptions.filter((item) => {
//       // Always include selected items
//       if (value.includes(getOptionValue(item))) return true
//       return filter(item, q)
//     })
//   }, [
//     filteredOptions,
//     search,
//     value,
//     getOptionValue,
//     getOptionLabel,
//     searchFilter,
//   ])
// }

// /**
//  * Hook to sort options (selected first if enabled)
//  */
// function useSortedOptions<T>(
//   searchFilteredOptions: Array<T>,
//   value: Array<string>,
//   showSelectedFirst: boolean,
//   getOptionValue: (item: T) => string,
//   getOptionLabel: (item: T) => string,
// ) {
//   return React.useMemo(() => {
//     if (!showSelectedFirst) return searchFilteredOptions

//     return [...searchFilteredOptions].sort((a, b) => {
//       const aSelected = value.includes(getOptionValue(a))
//       const bSelected = value.includes(getOptionValue(b))
//       if (aSelected === bSelected) {
//         // If both have same selection state, sort by label
//         return getOptionLabel(a).localeCompare(getOptionLabel(b))
//       }
//       return aSelected ? -1 : 1
//     })
//   }, [
//     searchFilteredOptions,
//     value,
//     showSelectedFirst,
//     getOptionValue,
//     getOptionLabel,
//   ])
// }

// /**
//  * StaticMultiSelect - Generic multi-select component for static data
//  *
//  * This component provides a reusable pattern for multi-select inputs with static data.
//  * Selected items are displayed as tags in the trigger button.
//  * Includes proper scrolling support for long lists.
//  *
//  * @example
//  * // ✅ Correct - Use with static array
//  * <StaticMultiSelect
//  *   options={SUBJECT_KEYS.map(key => ({ key, name: getSubjectLabel(key) }))}
//  *   getOptionValue={(item) => item.key}
//  *   getOptionLabel={(item) => item.name}
//  *   value={value}
//  *   onValueChange={setValue}
//  * />
//  *
//  * @example
//  * // ✅ Correct - With custom search filter
//  * <StaticMultiSelect
//  *   options={items}
//  *   getOptionValue={(item) => item.id}
//  *   getOptionLabel={(item) => item.name}
//  *   searchFilter={(item, search) => item.name.toLowerCase().includes(search)}
//  *   value={value}
//  *   onValueChange={setValue}
//  * />
//  */
// export function StaticMultiSelect<T>({
//   value = [],
//   onValueChange,
//   options,
//   getOptionValue,
//   getOptionLabel,
//   getOptionDisplay,
//   placeholder,
//   searchPlaceholder,
//   emptyMessage,
//   disabled = false,
//   className,
//   excludeIds = [],
//   showSelectedFirst = false,
//   searchFilter,
//   namespace = 'school',
// }: StaticMultiSelectProps<T>) {
//   const { t } = useTranslation(namespace)
//   const [open, setOpen] = React.useState(false)
//   const [search, setSearch] = React.useState('')

//   // Filter out excluded items
//   const filteredOptions = useFilteredOptions(
//     options,
//     excludeIds,
//     getOptionValue,
//   )

//   // Get selected items
//   const selectedItems = useSelectedItems(filteredOptions, value, getOptionValue)

//   // Client-side search filtering
//   const searchFilteredOptions = useSearchFilteredOptions(
//     filteredOptions,
//     search,
//     value,
//     getOptionValue,
//     getOptionLabel,
//     searchFilter,
//   )

//   // Sort items: selected first if showSelectedFirst is true
//   const sortedOptions = useSortedOptions(
//     searchFilteredOptions,
//     value,
//     showSelectedFirst,
//     getOptionValue,
//     getOptionLabel,
//   )

//   // Handlers
//   const handleToggle = React.useCallback(
//     (optionValue: string) => {
//       const newValue = value.includes(optionValue)
//         ? value.filter((v) => v !== optionValue)
//         : [...value, optionValue]
//       onValueChange?.(newValue)
//     },
//     [value, onValueChange],
//   )

//   const handleRemove = React.useCallback(
//     (optionValue: string, e: React.MouseEvent) => {
//       e.stopPropagation()
//       onValueChange?.(value.filter((v) => v !== optionValue))
//     },
//     [value, onValueChange],
//   )

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
//         className="w-[var(--radix-popover-trigger-width)] p-0 h-[200px] flex flex-col"
//         align="start"
//         onWheel={(e) => {
//           // Prevent wheel events from propagating to parent
//           // Let CommandList handle scroll naturally
//           e.stopPropagation()
//         }}
//         onTouchMove={(e) => {
//           // Prevent touch events from propagating to parent
//           e.stopPropagation()
//         }}
//         style={{ overscrollBehavior: 'contain' }}
//       >
//         <Command className="flex flex-col flex-1 min-h-0" shouldFilter={false}>
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
//           <CommandList className="flex-1 min-h-0 overflow-y-auto max-h-none">
//             <CommandEmpty>
//               {emptyMessage ??
//                 t('common.noResults', {
//                   defaultValue: 'No results found',
//                 })}
//             </CommandEmpty>
//             <CommandGroup>
//               {sortedOptions.map((item) => {
//                 const itemValue = getOptionValue(item)
//                 const isSelected = value.includes(itemValue)
//                 return (
//                   <CommandItem
//                     key={itemValue}
//                     value={itemValue}
//                     onSelect={() => handleToggle(itemValue)}
//                   >
//                     <Check
//                       className={cn(
//                         'mr-2 h-4 w-4',
//                         isSelected ? 'opacity-100' : 'opacity-0',
//                       )}
//                     />
//                     {getOptionDisplay ? (
//                       getOptionDisplay(item)
//                     ) : (
//                       <span className="truncate">{getOptionLabel(item)}</span>
//                     )}
//                   </CommandItem>
//                 )
//               })}
//             </CommandGroup>
//           </CommandList>
//         </Command>
//       </PopoverContent>
//     </Popover>
//   )
// }
