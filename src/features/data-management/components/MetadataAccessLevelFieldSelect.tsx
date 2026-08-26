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
import { activeSecurityLevelsQueryOptions } from '@/features/security-level/queries'
import type { SecurityLevelT } from '@/features/security-level/types'
import { cn } from '@/lib/utils/cn'

/**
 * Resolve the current metadata value (free-text label such as "Công khai"
 * or an id) to the matching security-level id so the Select can highlight
 * the correct option.
 */
function resolveAccessLevelOptionValue(
  rawValue: string,
  options: Array<SecurityLevelT>,
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''
  // Direct id match
  if (options.some((o) => o.id === trimmed)) return trimmed
  // Match by name (e.g. "Công khai", "Hạn chế")
  const byName = options.find(
    (o) => o.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return byName?.id ?? trimmed
}

export function resolveAccessLevelDisplayLabel(
  rawValue: string,
  options: Array<SecurityLevelT>,
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return '—'
  const byId = options.find((o) => o.id === trimmed)
  if (byId) return byId.name
  const byName = options.find(
    (o) => o.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return byName?.name ?? trimmed
}

export function MetadataAccessLevelFieldSelect({
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
  const { t } = useTranslation('data-management')
  const levelsQuery = useQuery({
    ...activeSecurityLevelsQueryOptions(),
    enabled: !disabled || Boolean(value.trim()),
  })
  const options = useMemo(() => {
    const items = [...(levelsQuery.data?.items ?? [])]
    items.sort((a, b) => a.levelOrder - b.levelOrder)
    return items
  }, [levelsQuery.data])

  const selectedValue = useMemo(
    () => resolveAccessLevelOptionValue(value, options),
    [options, value],
  )

  if (disabled) {
    return (
      <p className={cn('text-sm text-foreground', className)}>
        {levelsQuery.isPending
          ? t('recordDetail.accessLevelLoading')
          : resolveAccessLevelDisplayLabel(value, options)}
      </p>
    )
  }

  const placeholder = levelsQuery.isPending
    ? t('recordDetail.accessLevelLoading')
    : levelsQuery.isError
      ? t('recordDetail.accessLevelLoadFailed')
      : options.length === 0
        ? t('recordDetail.accessLevelEmpty')
        : t('recordDetail.accessLevelSelectPlaceholder')

  return (
    <Select
      value={selectedValue || undefined}
      onValueChange={(next) => {
        const selected = options.find((o) => o.id === next)
        // Store the human-readable name so backend metadata stays text-based
        const label = selected ? selected.name : next
        onValueChange?.(label)
      }}
      disabled={
        disabled || levelsQuery.isPending || levelsQuery.isError || options.length === 0
      }
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((level) => (
          <SelectItem key={level.id} value={level.id}>
            {level.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
