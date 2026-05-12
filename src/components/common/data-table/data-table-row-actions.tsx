import type { Row } from '@tanstack/react-table'
import { Edit, Eye, Trash } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type ActionVariant =
  | 'default'
  | 'destructive'
  | 'secondary'
  | 'outline'
  | 'ghost'

export interface TableAction<TData> {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label?: string
  onClick: (item: TData) => void
  variant?: ActionVariant
  disabled?: boolean | ((item: TData) => boolean)
  className?: string
}

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
  // Built-in actions (smart defaults)
  onView?: (item: TData) => void
  onEdit?: (item: TData) => void
  onDelete?: (item: TData) => void
  // Custom actions array (mapped over)
  actions?: Array<TableAction<TData>>
  // Legacy: children for additional custom buttons
  children?: React.ReactNode
  className?: string
  gap?: 'sm' | 'md' | 'lg' // Button gap spacing
  size?: 'sm' | 'lg' // Button size (default: 'sm')
  variant?: 'outline' | 'ghost' // Button variant (default: 'outline')
}

/**
 * DataTableRowActions - Reusable action buttons component for table rows
 *
 * Provides smart defaults for common actions (View, Edit, Delete) and supports
 * custom actions via an actions array. All buttons use consistent styling.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DataTableRowActions
 *   row={row}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 *
 * // With custom actions
 * <DataTableRowActions
 *   row={row}
 *   onEdit={handleEdit}
 *   actions={[
 *     {
 *       id: 'duplicate',
 *       icon: Copy,
 *       onClick: (item) => handleDuplicate(item),
 *     },
 *   ]}
 * />
 * ```
 */
export function DataTableRowActions<TData>({
  row,
  onView,
  onEdit,
  onDelete,
  actions = [],
  children,
  className,
  gap = 'sm',
  size = 'sm',
  variant = 'ghost',
}: DataTableRowActionsProps<TData>) {
  const item = row.original
  const gapClass = {
    sm: 'gap-1',
    md: 'gap-2',
    lg: 'gap-3',
  }[gap]

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const buttonHeight = size === 'sm' ? 'h-7' : 'h-8'

  // Built-in actions (smart defaults)
  const builtInActions: Array<TableAction<TData>> = []

  if (onView) {
    builtInActions.push({
      id: 'view',
      icon: Eye,
      onClick: onView,
      variant,
    })
  }

  if (onEdit) {
    builtInActions.push({
      id: 'edit',
      icon: Edit,
      onClick: onEdit,
      variant,
    })
  }

  if (onDelete) {
    builtInActions.push({
      id: 'delete',
      icon: Trash,
      onClick: onDelete,
      variant,
      className: 'text-destructive hover:text-destructive',
    })
  }

  // Combine built-in and custom actions
  const allActions = [...builtInActions, ...actions]

  return (
    <div className={cn('flex items-center justify-end', gapClass, className)}>
      {allActions.map((action) => {
        const Icon = action.icon
        const isDisabled =
          typeof action.disabled === 'function'
            ? action.disabled(item)
            : (action.disabled ?? false)

        return (
          <Button
            key={action.id}
            variant={action.variant ?? variant}
            size={size}
            className={cn(buttonHeight, action.className)}
            onClick={() => action.onClick(item)}
            disabled={isDisabled}
            title={action.label}
          >
            <Icon className={iconSize} />
          </Button>
        )
      })}
      {children}
    </div>
  )
}
