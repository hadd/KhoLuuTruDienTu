import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'
import { MetadataSearchableSelect } from '@/features/data-management/components/MetadataSearchableSelect'
import { cn } from '@/lib/utils/cn'

function resolveFondOptionValue(
  rawValue: string,
  options: Array<{ id: string; fondName: string }>,
): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''
  const byId = options.find(
    (option) =>
      option.id === trimmed ||
      option.id.toLowerCase() === trimmed.toLowerCase(),
  )
  if (byId) {
    return byId.id
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
  const byId = options.find(
    (option) =>
      option.id === trimmed ||
      option.id.toLowerCase() === trimmed.toLowerCase(),
  )
  if (byId) return `${byId.fondName} (${byId.id})`
  const byName = options.find(
    (option) =>
      option.fondName.trim() === trimmed ||
      option.fondName.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return byName ? `${byName.fondName} (${byName.id})` : trimmed
}

export function MetadataFondFieldSelect({
  value,
  onValueChange,
  disabled = false,
  readOnlyInherited = false,
  className,
}: {
  value: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  readOnlyInherited?: boolean
  className?: string
}) {
  const { t } = useTranslation('data-management')
  const fondsQuery = useQuery({
    ...activeArchiveFondsQueryOptions(),
    enabled: !disabled || readOnlyInherited || Boolean(value.trim()),
  })
  const options = fondsQuery.data?.items ?? []

  const selectedValue = useMemo(
    () => resolveFondOptionValue(value, options),
    [options, value],
  )

  const searchableOptions = useMemo(
    () =>
      options.map((fond) => ({
        value: fond.id,
        label: fond.fondName,
      })),
    [options],
  )

  if (disabled && !readOnlyInherited) {
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

  const displayLabel =
    selectedValue.trim() && !fondsQuery.isPending
      ? resolveFondDisplayLabel(value, options)
      : undefined

  return (
    <div
      title={
        readOnlyInherited
          ? 'Phông lưu trữ được tự động áp dụng từ cấp Hồ sơ'
          : undefined
      }
      className={cn(readOnlyInherited && 'cursor-not-allowed opacity-90')}
    >
      <MetadataSearchableSelect
        options={searchableOptions}
        value={selectedValue}
        onValueChange={(next) => onValueChange?.(next)}
        placeholder={placeholder}
        searchPlaceholder={t('recordDetail.fondSearchPlaceholder')}
        emptyText={t('recordDetail.fondEmpty')}
        noResultsText={t('recordDetail.searchNoResults')}
        disabled={
          disabled ||
          readOnlyInherited ||
          fondsQuery.isPending ||
          fondsQuery.isError ||
          options.length === 0
        }
        className={cn(readOnlyInherited && 'bg-muted/50 cursor-not-allowed', className)}
        displayLabel={displayLabel === '—' ? undefined : displayLabel}
      />
    </div>
  )
}

