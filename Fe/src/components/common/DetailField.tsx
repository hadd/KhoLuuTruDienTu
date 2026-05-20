import { cn } from '@/lib/utils/cn'

interface DetailFieldProps {
  label: string
  children: React.ReactNode
  variant?: 'default' | 'compact'
  className?: string
}

/**
 * DetailField - Reusable component for displaying label/value pairs in detail views
 *
 * Supports two variants:
 * - default: text-sm font-medium text-muted-foreground mb-1 (used in ClassDetail, CourseDetail)
 * - compact: text-xs font-medium uppercase text-muted-foreground (used in DeviceCommandDetailDialog)
 */
export function DetailField({
  label,
  children,
  variant = 'default',
  className,
}: DetailFieldProps) {
  if (variant === 'compact') {
    return (
      <div className={className}>
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {label}
        </p>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="text-sm font-medium text-muted-foreground mb-1">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
