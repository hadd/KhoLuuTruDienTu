import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export function WarehouseIconCircle({
  icon: Icon,
  selected = false,
  className,
}: {
  icon: LucideIcon
  selected?: boolean
  className?: string
}) {
  return (
    <Icon
      className={cn(
        'size-12 text-primary/75 transition-colors duration-200 group-hover:text-primary sm:size-14',
        selected && 'text-primary',
        className,
      )}
      aria-hidden
    />
  )
}

export function WarehouseIconTile({
  icon: Icon,
  label,
  description,
  selected = false,
  onClick,
}: {
  icon: LucideIcon
  label: string
  description?: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <li className="group flex flex-col items-center text-center">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          'flex w-full max-w-[12rem] flex-col items-center gap-3 text-center',
          'cursor-pointer transition-transform duration-200 group-hover:-translate-y-0.5',
        )}
      >
        <WarehouseIconCircle icon={Icon} selected={selected} />

        <div className="w-full max-w-[12rem] px-1">
          <p
            className={cn(
              'text-sm font-semibold tracking-tight text-foreground',
              description ? 'truncate' : 'line-clamp-2',
              selected && 'text-primary',
            )}
          >
            {label}
          </p>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </button>
    </li>
  )
}

export function WarehouseIconTileGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
        className,
      )}
    >
      {children}
    </ul>
  )
}
