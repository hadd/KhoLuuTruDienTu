import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type RouteErrorStateProps = {
  error: unknown
  onRetry: () => void
  title?: string
  fallbackMessage?: string
  retryLabel?: string
  containerClassName?: string
  cardClassName?: string
  messageResolver?: (error: unknown) => string
}

export function RouteErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  fallbackMessage = 'An unexpected error occurred',
  retryLabel = 'Try Again',
  containerClassName,
  cardClassName,
  messageResolver,
}: RouteErrorStateProps) {
  const message = messageResolver
    ? messageResolver(error)
    : error instanceof Error
      ? error.message
      : fallbackMessage

  return (
    <div className={cn('mx-auto max-w-4xl px-6 py-8', containerClassName)}>
      <div
        className={cn(
          'rounded-lg border border-destructive bg-card p-8 text-center',
          cardClassName,
        )}
      >
        <h2 className="mb-2 text-xl font-semibold text-destructive">{title}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{message}</p>
        <Button onClick={onRetry} variant="outline">
          {retryLabel}
        </Button>
      </div>
    </div>
  )
}
