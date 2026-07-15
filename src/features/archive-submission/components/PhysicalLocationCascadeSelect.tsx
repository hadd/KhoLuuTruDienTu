import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getArchivePhysicalLocationItems,
  getArchivePhysicalLocationLevels,
} from '@/features/archive-submission/api/archiveSubmissionClient'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'

interface PhysicalLocationCascadeSelectProps {
  value?: string
  onValueChange: (value: string) => void
  disabled?: boolean
  /** When true (default), bottom step only shows boxes with free capacity. */
  availableOnly?: boolean
}

export function PhysicalLocationCascadeSelect({
  value = '',
  onValueChange,
  disabled = false,
  availableOnly = true,
}: PhysicalLocationCascadeSelectProps) {
  const { t } = useTranslation('archive-submission')
  const [path, setPath] = useState<Array<string>>([])

  const levelsQuery = useQuery({
    queryKey: ['archive-physical-location-levels'],
    queryFn: getArchivePhysicalLocationLevels,
    staleTime: 30_000,
  })

  const sortedLevels = useMemo(
    () =>
      [...(levelsQuery.data ?? [])].sort(
        (a, b) => a.levelOrder - b.levelOrder,
      ),
    [levelsQuery.data],
  )

  // Cascade steps: location roots + each configured level
  const stepCount = sortedLevels.length + 1

  const parentIdsForSteps = useMemo(() => {
    const parents: Array<string | undefined> = []
    for (let i = 0; i < stepCount; i += 1) {
      parents.push(i === 0 ? undefined : path[i - 1])
    }
    return parents
  }, [path, stepCount])

  const itemQueries = useQueries({
    queries: parentIdsForSteps.map((parentId, index) => {
      const isBottomStep = index === stepCount - 1
      const enabled =
        !levelsQuery.isPending &&
        sortedLevels.length > 0 &&
        (index === 0 || Boolean(parentId))
      return {
        queryKey: [
          'archive-physical-location-items',
          parentId ?? 'roots',
          isBottomStep && availableOnly ? 'available' : 'all',
        ],
        queryFn: () =>
          getArchivePhysicalLocationItems({
            parentId,
            availableOnly: isBottomStep ? availableOnly : false,
          }),
        enabled,
        staleTime: 15_000,
      }
    }),
  })

  // Reset cascade when cleared externally
  useEffect(() => {
    if (!value) {
      setPath([])
    }
  }, [value])

  function stepLabel(index: number): string {
    if (index === 0) return t('physicalLocation.location')
    return sortedLevels[index - 1]?.levelName ?? t('physicalLocation.level')
  }

  function handleSelect(stepIndex: number, nextId: string) {
    const nextPath = [...path.slice(0, stepIndex), nextId]
    setPath(nextPath)
    const isLast = stepIndex === stepCount - 1
    if (isLast) {
      onValueChange(nextId)
    } else {
      onValueChange('')
    }
  }

  function optionLabel(item: PhysicalWarehouseItemT, isBottom: boolean): string {
    if (
      isBottom &&
      item.capacity != null &&
      item.usedCapacity != null
    ) {
      return `${item.name} (${item.usedCapacity}/${item.capacity})`
    }
    return item.name
  }

  if (levelsQuery.isPending) {
    return <p className="text-sm text-muted-foreground">{t('form.loading')}</p>
  }

  if (levelsQuery.isError || sortedLevels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('physicalLocation.noLevels')}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: stepCount }).map((_, stepIndex) => {
        const isBottom = stepIndex === stepCount - 1
        const query = itemQueries[stepIndex]
        const options = query?.data ?? []
        const selected = path[stepIndex] ?? ''
        const locked = stepIndex > 0 && !path[stepIndex - 1]

        return (
          <div key={stepIndex} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {stepLabel(stepIndex)}
            </Label>
            <Select
              value={selected}
              onValueChange={(next) => handleSelect(stepIndex, next)}
              disabled={
                disabled ||
                locked ||
                query?.isPending ||
                query?.isError ||
                options.length === 0
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    locked
                      ? t('physicalLocation.selectParentFirst')
                      : query?.isPending
                        ? t('form.loading')
                        : options.length === 0
                          ? t('physicalLocation.emptyStep')
                          : t('form.selectPlaceholder')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {optionLabel(item, isBottom)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
      {value ? (
        <p className="text-xs text-muted-foreground">
          {t('physicalLocation.selectedHint')}
        </p>
      ) : null}
    </div>
  )
}
