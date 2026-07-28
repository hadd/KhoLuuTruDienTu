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
import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'
import { cn } from '@/lib/utils/cn'

function resolveFondOptionValue(
  rawValue: string,
  options: Array<{ id: string; fondName: string }>,
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''
  if (options.some((option) => option.id === trimmed)) {
    return trimmed
  }
  const byName = options.find(
    (option) =>
      option.fondName.trim() === trimmed ||
      option.fondName.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return byName?.id ?? trimmed
}

export function resolveFondDisplayLabel(
  rawValue: string,
  options: Array<{ id: string; fondName: string }>,
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return '—'
  const byId = options.find((option) => option.id === trimmed)
  if (byId) return byId.fondName
  const byName = options.find(
    (option) =>
      option.fondName.trim() === trimmed ||
      option.fondName.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return byName?.fondName ?? trimmed
}

export function MetadataFondFieldSelect({
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
  const fondsQuery = useQuery({
    ...activeArchiveFondsQueryOptions(),
    enabled: !disabled || Boolean(value.trim()),
  })
  const options = fondsQuery.data?.items ?? []

  const selectedValue = useMemo(
    () => resolveFondOptionValue(value, options),
    [options, value],
  )

  if (disabled) {
    return (
      <p className={cn('text-sm text-foreground', className)}>
        {fondsQuery.isPending
          ? t('recordDetail.fondLoading')
          : resolveFondDisplayLabel(value, options)}
      </p>
    )
  }

  const placeholder = fondsQuery.isPending
    ? t('recordDetail.fondLoading')
    : fondsQuery.isError
      ? t('recordDetail.fondLoadFailed')
      : options.length === 0
        ? t('recordDetail.fondEmpty')
        : t('recordDetail.fondSelectPlaceholder')

  return (
    <Select
      value={selectedValue || undefined}
      onValueChange={(next) => onValueChange?.(next)}
      disabled={
        disabled || fondsQuery.isPending || fondsQuery.isError || options.length === 0
      }
    >
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((fond) => (
          <SelectItem key={fond.id} value={fond.id}>
            {fond.fondName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
