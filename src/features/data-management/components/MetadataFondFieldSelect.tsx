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

  return (
    <Select
      value={selectedValue || undefined}
      onValueChange={(next) => onValueChange?.(next)}
      disabled={
        disabled ||
        readOnlyInherited ||
        fondsQuery.isPending ||
        fondsQuery.isError ||
        options.length === 0
      }
    >
      <SelectTrigger
        className={cn(
          'w-full',
          readOnlyInherited && 'cursor-not-allowed bg-muted/50 opacity-90',
          className,
        )}
        title={
          readOnlyInherited
            ? 'Phông lưu trữ được tự động áp dụng từ cấp Hồ sơ'
            : undefined
        }
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((fond) => (
          <SelectItem key={fond.id} value={fond.id}>
            <span>{fond.fondName}</span>
            <span className="ml-1.5 text-xs text-muted-foreground font-mono">
              ({fond.id})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
