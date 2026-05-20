import { Inbox } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  message: string
  description?: string
  className?: string
}

export function EmptyState({
  message,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 w-full items-center justify-center rounded-lg border border-border bg-card',
        className,
      )}
    >
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-base font-medium text-muted-foreground">{message}</p>
        {description ? (
          <p className="max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}
