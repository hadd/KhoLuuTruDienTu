// import { ChevronsUpDown, SearchIcon } from 'lucide-react'
// import * as React from 'react'
// import { useTranslation } from 'react-i18next'

// import { Button } from '@/components/ui/button'
// import { Label } from '@/components/ui/label'
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from '@/components/ui/popover'
// import { cn } from '@/lib/utils/cn'
// import type { OutcomeT } from '@/types/common'

// function flattenOutcomesForSearch(
//   outcomes: Array<OutcomeT>,
//   level = 0,
// ): Array<OutcomeT & { displayLabel: string }> {
//   const result: Array<OutcomeT & { displayLabel: string }> = []
//   for (const o of outcomes) {
//     const displayLabel =
//       (level > 0 ? '  '.repeat(level) : '') +
//       (o.code ? `${o.code}: ` : '') +
//       (o.name || '')
//     result.push({ ...o, displayLabel })
//     if (o.children?.length) {
//       result.push(...flattenOutcomesForSearch(o.children, level + 1))
//     }
//   }
//   return result
// }

// function filterTree(
//   items: Array<OutcomeT>,
//   query: string,
// ): Array<OutcomeT> {
//   if (!query.trim()) return items

//   const q = query.toLowerCase()
//   return items
//     .map((item) => {
//       const matches =
//         item.name.toLowerCase().includes(q) ||
//         (item.description?.toLowerCase() ?? '').includes(q) ||
//         (item.code?.toLowerCase() ?? '').includes(q)

//       const filteredChildren = item.children
//         ? filterTree(item.children, query)
//         : undefined

//       if (matches || (filteredChildren && filteredChildren.length > 0)) {
//         return {
//           ...item,
//           children:
//             filteredChildren && filteredChildren.length > 0
//               ? filteredChildren
//               : item.children,
//         } as OutcomeT
//       }
//       return null
//     })
//     .filter((item): item is OutcomeT => item !== null)
// }

// interface OutcomeTreeNodeProps {
//   outcome: OutcomeT
//   level: number
//   selectedIds: Array<string>
//   onToggle: (id: string) => void
// }

// function OutcomeTreeNode({
//   outcome,
//   level,
//   selectedIds,
//   onToggle,
// }: OutcomeTreeNodeProps) {
//   const isSelected = selectedIds.includes(outcome.id)
//   const label = [outcome.code, outcome.name].filter(Boolean).join(': ') || outcome.name

//   return (
//     <div className="space-y-0.5">
//       <div
//         className={cn(
//           'flex items-start gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer',
//           isSelected && 'bg-accent',
//         )}
//         style={{ paddingLeft: `${8 + level * 16}px` }}
//         onClick={() => onToggle(outcome.id)}
//       >
//         <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
//           <input
//             type="checkbox"
//             checked={isSelected}
//             onChange={() => onToggle(outcome.id)}
//             onClick={(e) => e.stopPropagation()}
//             className="h-4 w-4 rounded border-border text-primary focus:ring-ring focus:ring-2 focus:ring-offset-0 cursor-pointer"
//           />
//         </div>
//         <div className="flex-1 min-w-0">
//           <span className="text-sm font-normal leading-snug text-foreground truncate block">
//             {label}
//           </span>
//         </div>
//       </div>
//       {outcome.children && outcome.children.length > 0 && (
//         <div>
//           {outcome.children.map((child) => (
//             <OutcomeTreeNode
//               key={child.id}
//               outcome={child}
//               level={level + 1}
//               selectedIds={selectedIds}
//               onToggle={onToggle}
//             />
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }

// export interface ObjectiveMultiSelectProps {
//   value: Array<string>
//   onChange: (ids: Array<string>) => void
//   outcomes: Array<OutcomeT>
//   disabled?: boolean
//   label?: React.ReactNode
//   placeholder?: string
//   className?: string
//   error?: string
//   /** When true, trigger uses full width (e.g. in form grid). Default true. */
//   fullWidth?: boolean
// }

// export function ObjectiveMultiSelect({
//   value,
//   onChange,
//   outcomes,
//   disabled = false,
//   label,
//   placeholder,
//   className,
//   error,
//   fullWidth = true,
// }: ObjectiveMultiSelectProps) {
//   const { t } = useTranslation('question-studio')
//   const [open, setOpen] = React.useState(false)
//   const [search, setSearch] = React.useState('')

//   const selectedIds = value
//   const flatOutcomes = React.useMemo(
//     () => flattenOutcomesForSearch(outcomes),
//     [outcomes],
//   )

//   const filteredTree = React.useMemo(
//     () => (search.trim() ? filterTree(outcomes, search) : outcomes),
//     [outcomes, search],
//   )

//   const triggerLabel =
//     selectedIds.length > 0
//       ? selectedIds.length === 1
//         ? (flatOutcomes.find((o) => o.id === selectedIds[0])?.displayLabel ??
//           selectedIds[0])
//         : t('leftPanel.multipleObjectives', {
//             count: selectedIds.length,
//             defaultValue: '{{count}} mục tiêu',
//           })
//       : (placeholder ??
//         t('leftPanel.noOutcomes', { defaultValue: 'Chọn mục tiêu...' }))

//   const handleToggle = (outcomeId: string) => {
//     const next = selectedIds.includes(outcomeId)
//       ? selectedIds.filter((id) => id !== outcomeId)
//       : [...selectedIds, outcomeId]
//     onChange(next)
//   }

//   if (outcomes.length === 0) return null

//   return (
//     <div className={cn('space-y-2', className)}>

//       <Popover open={open} onOpenChange={setOpen}>
//         <PopoverTrigger asChild>
//           <Button
//             variant="outline"
//             role="combobox"
//             aria-expanded={open}
//             disabled={disabled}
//             size="sm"
//             className={cn(
//               'justify-between font-normal h-8',
//               fullWidth && 'w-full',
//               !selectedIds.length && 'text-muted-foreground',
//               error && 'border-destructive focus-visible:ring-destructive',
//             )}
//           >
//             <span className="truncate">{triggerLabel}</span>
//             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//           </Button>
//         </PopoverTrigger>
//         <PopoverContent
//           className="w-[400px] p-0 flex flex-col overflow-hidden max-h-[360px]"
//           align="start"
//           onWheel={(e) => e.stopPropagation()}
//           onTouchMove={(e) => e.stopPropagation()}
//           style={{ overscrollBehavior: 'contain' }}
//         >
//           <div className="flex h-9 items-center gap-2 border-b border-border pl-2 pr-3 flex-shrink-0">
//             <SearchIcon className="size-4 shrink-0 opacity-50" />
//             <input
//               type="text"
//               placeholder={t('leftPanel.searchObjectivesPlaceholder', {
//                 defaultValue: 'Tìm kiếm mục tiêu...',
//               })}
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
//             />
//           </div>
//           <div className="flex-1 min-h-0 overflow-y-auto overscroll-behavior-contain p-1">
//             {filteredTree.length === 0 ? (
//               <div className="py-6 text-center text-sm text-muted-foreground">
//                 {t('leftPanel.noOutcomes', {
//                   defaultValue: 'Không có mục tiêu nào',
//                 })}
//               </div>
//             ) : (
//               <div className="space-y-0.5">
//                 {filteredTree.map((outcome) => (
//                   <OutcomeTreeNode
//                     key={outcome.id}
//                     outcome={outcome}
//                     level={0}
//                     selectedIds={selectedIds}
//                     onToggle={handleToggle}
//                   />
//                 ))}
//               </div>
//             )}
//           </div>
//         </PopoverContent>
//       </Popover>
//     </div>
//   )
// }
