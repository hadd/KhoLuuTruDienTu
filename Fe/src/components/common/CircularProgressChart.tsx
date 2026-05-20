import { cn } from '@/lib/utils/cn'

interface CircularProgressChartProps {
  percentage: number | null
  size?: number
  strokeWidth?: number
  className?: string
  level?: 'weak' | 'good' | 'excellent'
}

export function CircularProgressChart({
  percentage,
  size = 48,
  strokeWidth = 4,
  className,
  level,
}: CircularProgressChartProps) {
  const normalizedPercentage = percentage ?? 0
  const clampedPercentage = Math.min(Math.max(normalizedPercentage, 0), 100)

  // Calculate radius and circumference
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  // If percentage is 0, show 100% red circle
  const offset =
    clampedPercentage === 0
      ? 0
      : circumference - (clampedPercentage / 100) * circumference

  // Color based on percentage and level
  const getColor = () => {
    if (clampedPercentage === 0) return 'stroke-destructive'
    if (level === 'weak') return 'stroke-yellow-500'
    if (level === 'good') return 'stroke-primary'
    if (level === 'excellent') return 'stroke-emerald-600'
    return 'stroke-primary'
  }

  const color = getColor()

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        className,
      )}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-all duration-300', color)}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-foreground">
          {!isNaN(Number(normalizedPercentage))
            ? `${Math.round(clampedPercentage)}%`
            : '-'}
        </span>
      </div>
    </div>
  )
}
