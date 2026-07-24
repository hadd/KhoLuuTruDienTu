import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

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
          'flex w-full max-w-[11rem] flex-col items-center text-center',
          'cursor-pointer',
        )}
      >
        <div
          className={cn(
            'relative aspect-square w-full max-w-[11rem] rounded-full ring-1 ring-border/80',
            'shadow-[0_10px_28px_-14px_rgba(15,23,42,0.35)] transition-all duration-300',
            'group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-primary/40',
            'group-hover:shadow-[0_18px_36px_-16px_rgba(37,99,235,0.45)]',
            selected && 'ring-2 ring-primary/50 shadow-[0_18px_36px_-16px_rgba(37,99,235,0.45)]',
          )}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full bg-gradient-to-br from-primary/15 via-muted to-background">
            <div className="flex size-full flex-col items-center justify-center text-muted-foreground">
              <Icon
                className={cn(
                  'size-8 text-primary/70',
                  selected && 'text-primary',
                )}
                aria-hidden
              />
            </div>
          </div>
        </div>

        <div className="mt-3 w-full max-w-[11rem] px-1">
          <p
            className={cn(
              'truncate text-sm font-semibold tracking-tight text-foreground',
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
        'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className,
      )}
    >
      {children}
    </ul>
  )
}
