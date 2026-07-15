import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { activeArchiveFondsQueryOptions } from '@/features/archive-fond/queries'

const DEFAULT_FOND_I18N_KEYS = {
  labelKey: 'actionDialog.assignFond.fondLabel',
  placeholderKey: 'actionDialog.assignFond.fondPlaceholder',
  loadingKey: 'actionDialog.assignFond.fondLoading',
  loadFailedKey: 'actionDialog.assignFond.fondLoadFailed',
  emptyKey: 'actionDialog.assignFond.fondEmpty',
} as const

export interface FondSelectProps {
  value?: string
  onValueChange: (fondId: string) => void
  className?: string
  enabled?: boolean
  labelKey?: string
  placeholderKey?: string
  loadingKey?: string
  loadFailedKey?: string
  emptyKey?: string
}

export function FondSelect({
  value,
  onValueChange,
  className,
  enabled = true,
  labelKey = DEFAULT_FOND_I18N_KEYS.labelKey,
  placeholderKey = DEFAULT_FOND_I18N_KEYS.placeholderKey,
  loadingKey = DEFAULT_FOND_I18N_KEYS.loadingKey,
  loadFailedKey = DEFAULT_FOND_I18N_KEYS.loadFailedKey,
  emptyKey = DEFAULT_FOND_I18N_KEYS.emptyKey,
}: FondSelectProps) {
  const { t } = useTranslation('data-management')
  const { data: fondsData, isPending, isError } = useQuery({
    ...activeArchiveFondsQueryOptions(),
    enabled,
  })
  const fonds = fondsData?.items ?? []

  return (
    <Select
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={isPending || isError || fonds.length === 0}
    >
      <SelectTrigger className={className} aria-label={t(labelKey)}>
        <SelectValue
          placeholder={
            isPending
              ? t(loadingKey)
              : isError
                ? t(loadFailedKey)
                : fonds.length === 0
                  ? t(emptyKey)
                  : t(placeholderKey)
          }
        />
      </SelectTrigger>
      <SelectContent>
        {fonds.map((fond) => (
          <SelectItem key={fond.id} value={fond.id}>
            {fond.fondName} ({fond.id})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
