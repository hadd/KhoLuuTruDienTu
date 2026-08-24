import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { activeRetentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import type { RetentionPeriodT } from '@/features/retention-period/types'
import { cn } from '@/lib/utils/cn'

/**
 * Resolve the current metadata value (free-text label such as "Vĩnh viễn",
 * "10 năm", or an id) to the matching retention-period id so the Select
 * can highlight the correct option.
 */
function resolveRetentionOptionValue(
  rawValue: string,
  options: Array<RetentionPeriodT>,
  t: ReturnType<typeof useTranslation<'retention-period'>>['t'],
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''
  // Direct id match
  if (options.some((o) => o.id === trimmed)) return trimmed
  // Match by formatted label (e.g. "Vĩnh viễn", "10 năm")
  const byLabel = options.find(
    (o) =>
      formatRetentionDurationLabel(o, t).toLowerCase() ===
      trimmed.toLowerCase(),
  )
  return byLabel?.id ?? trimmed
}

export function resolveRetentionDisplayLabel(
  rawValue: string,
  options: Array<RetentionPeriodT>,
  t: ReturnType<typeof useTranslation<'retention-period'>>['t'],
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return '—'
  const byId = options.find((o) => o.id === trimmed)
  if (byId) return formatRetentionDurationLabel(byId, t)
  const byLabel = options.find(
    (o) =>
      formatRetentionDurationLabel(o, t).toLowerCase() ===
      trimmed.toLowerCase(),
  )
  return byLabel ? formatRetentionDurationLabel(byLabel, t) : trimmed
}

export function MetadataRetentionFieldSelect({
  value,
  onValueChange,
  disabled = false,
  className,
}: {
  value: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation('retention-period')
  const { t: tDm } = useTranslation('data-management')
  const periodsQuery = useQuery({
    ...activeRetentionPeriodsQueryOptions(),
    enabled: !disabled || Boolean(value.trim()),
  })
  const options = periodsQuery.data?.items ?? []

  const selectedValue = useMemo(
    () => resolveRetentionOptionValue(value, options, t),
    [options, value, t],
  )

  if (disabled) {
    return (
      <p className={cn('text-sm text-foreground', className)}>
        {periodsQuery.isPending
          ? tDm('recordDetail.retentionLoading')
          : resolveRetentionDisplayLabel(value, options, t)}
      </p>
    )
  }

  const placeholder = periodsQuery.isPending
    ? tDm('recordDetail.retentionLoading')
    : periodsQuery.isError
      ? tDm('recordDetail.retentionLoadFailed')
      : options.length === 0
        ? tDm('recordDetail.retentionEmpty')
        : tDm('recordDetail.retentionSelectPlaceholder')

  return (
    <Select
      value={selectedValue || undefined}
      onValueChange={(next) => {
        const selected = options.find((o) => o.id === next)
        // Store the human-readable label so backend metadata stays text-based
        const label = selected ? formatRetentionDurationLabel(selected, t) : next
        onValueChange?.(label)
      }}
      disabled={
        disabled || periodsQuery.isPending || periodsQuery.isError || options.length === 0
      }
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((period) => (
          <SelectItem key={period.id} value={period.id}>
            {formatRetentionDurationLabel(period, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
