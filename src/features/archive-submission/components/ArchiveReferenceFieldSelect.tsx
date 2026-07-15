import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { archiveFondsQueryOptions } from '@/features/archive-fond/queries'
import type { ArchiveReferenceSourceT } from '@/features/archive-config/types'
import { dossierTypesQueryOptions } from '@/features/dossier-type/queries'
import { inventoriesQueryOptions } from '@/features/inventory/queries'
import { retentionPeriodsQueryOptions } from '@/features/retention-period/queries'
import { formatRetentionDurationLabel } from '@/features/retention-period/lib/formatRetentionDuration'
import { PhysicalLocationCascadeSelect } from '@/features/archive-submission/components/PhysicalLocationCascadeSelect'

const LIST_LIMIT = 100

interface ArchiveReferenceFieldSelectProps {
  referenceSource: ArchiveReferenceSourceT
  value?: string
  onValueChange: (value: string) => void
  dependsOnValue?: string
  disabled?: boolean
}

export function ArchiveReferenceFieldSelect({
  referenceSource,
  value,
  onValueChange,
  dependsOnValue,
  disabled = false,
}: ArchiveReferenceFieldSelectProps) {
  if (referenceSource === 'PHYSICAL_BOTTOM_ITEM') {
    return (
      <PhysicalLocationCascadeSelect
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        availableOnly
      />
    )
  }

  return (
    <ArchiveCatalogReferenceSelect
      referenceSource={referenceSource}
      value={value}
      onValueChange={onValueChange}
      dependsOnValue={dependsOnValue}
      disabled={disabled}
    />
  )
}

function ArchiveCatalogReferenceSelect({
  referenceSource,
  value,
  onValueChange,
  dependsOnValue,
  disabled = false,
}: ArchiveReferenceFieldSelectProps) {
  const { t } = useTranslation('archive-submission')
  const { t: tRetention } = useTranslation('retention-period')

  const fondsQuery = useQuery({
    ...archiveFondsQueryOptions({ page: 1, limit: LIST_LIMIT }),
    enabled: referenceSource === 'FOND',
  })
  const inventoriesQuery = useQuery({
    ...inventoriesQueryOptions({ page: 1, limit: LIST_LIMIT }),
    enabled: referenceSource === 'INVENTORY' && Boolean(dependsOnValue),
  })
  const retentionPeriodsQuery = useQuery({
    ...retentionPeriodsQueryOptions({ page: 1, limit: LIST_LIMIT }),
    enabled: referenceSource === 'RETENTION_PERIOD',
  })
  const dossierTypesQuery = useQuery({
    ...dossierTypesQueryOptions({ page: 1, limit: LIST_LIMIT }),
    enabled: referenceSource === 'DOSSIER_TYPE',
  })

  const isPending =
    (referenceSource === 'FOND' && fondsQuery.isPending) ||
    (referenceSource === 'INVENTORY' &&
      Boolean(dependsOnValue) &&
      inventoriesQuery.isPending) ||
    (referenceSource === 'RETENTION_PERIOD' && retentionPeriodsQuery.isPending) ||
    (referenceSource === 'DOSSIER_TYPE' && dossierTypesQuery.isPending)

  const isError =
    (referenceSource === 'FOND' && fondsQuery.isError) ||
    (referenceSource === 'INVENTORY' &&
      Boolean(dependsOnValue) &&
      inventoriesQuery.isError) ||
    (referenceSource === 'RETENTION_PERIOD' && retentionPeriodsQuery.isError) ||
    (referenceSource === 'DOSSIER_TYPE' && dossierTypesQuery.isError)

  let options: Array<{ id: string; label: string }> = []
  if (referenceSource === 'FOND') {
    options = (fondsQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      label: `${item.fondName} (${item.id})`,
    }))
  } else if (referenceSource === 'INVENTORY') {
    options = (inventoriesQuery.data?.items ?? [])
      .filter((item) => !dependsOnValue || item.fondId === dependsOnValue)
      .map((item) => ({
        id: item.id,
        label: `${item.name} (${item.number})`,
      }))
  } else if (referenceSource === 'RETENTION_PERIOD') {
    options = (retentionPeriodsQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      label: formatRetentionDurationLabel(item, tRetention),
    }))
  } else if (referenceSource === 'DOSSIER_TYPE') {
    options = (dossierTypesQuery.data?.items ?? []).map((item) => ({
      id: item.id,
      label: item.name,
    }))
  }

  const isInventoryBlocked = referenceSource === 'INVENTORY' && !dependsOnValue

  return (
    <Select
      value={value ?? ''}
      onValueChange={onValueChange}
      disabled={disabled || isPending || isError || isInventoryBlocked || options.length === 0}
    >
      <SelectTrigger>
        <SelectValue
          placeholder={
            isInventoryBlocked
              ? t('form.selectFondFirst')
              : isPending
                ? t('form.loading')
                : isError
                  ? t('form.loadFailed')
                  : options.length === 0
                    ? t('form.empty')
                    : t('form.selectPlaceholder')
          }
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
