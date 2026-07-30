import { useQueries, useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getArchivePhysicalLocationItems } from '@/features/archive-submission/api/archiveSubmissionClient'
import { getPhysicalWarehouseItem } from '@/features/physical-warehouse/api/physicalWarehouseClient'
import type { PhysicalWarehouseItemT } from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'

const ALL_VALUE = 'ALL'

type PhysicalWarehouseFilterSelectProps = {
  value?: string
  onValueChange: (value: string | undefined) => void
  disabled?: boolean
  layout?: 'inline' | 'grid'
}

async function resolveAncestorPath(itemId: string): Promise<Array<string>> {
  const path: Array<string> = []
  let currentId: string | null = itemId
  const guard = new Set<string>()

  while (currentId && !guard.has(currentId)) {
    guard.add(currentId)
    const item = await getPhysicalWarehouseItem(currentId)
    path.unshift(item.id)
    currentId = item.parentId
  }

  return path
}

function PhysicalWarehouseStatusMessage({
  label,
  children,
  tone = 'muted',
}: {
  label: string
  children: React.ReactNode
  tone?: 'muted' | 'destructive'
}) {
  return (
    <div className="min-w-[180px]">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <div
        className={cn(
          'flex h-10 items-center text-sm',
          tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function levelLabel(depth: number, t: (key: string) => string): string {
  if (depth === 0) return t('disposal.filters.physicalLocation')
  if (depth === 1) return t('disposal.filters.physicalWarehouseLevel')
  return t('disposal.filters.physicalStorageLevel')
}

export function PhysicalWarehouseFilterSelect({
  value,
  onValueChange,
  disabled = false,
  layout = 'inline',
}: PhysicalWarehouseFilterSelectProps) {
  const { t } = useTranslation('archive-disposal')
  const [pathIds, setPathIds] = useState<Array<string>>([])

  const ancestorPathQuery = useQuery({
    queryKey: ['physical-warehouse-filter-path', value],
    queryFn: () => resolveAncestorPath(value!),
    enabled: Boolean(value),
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!value) {
      setPathIds([])
      return
    }
    if (ancestorPathQuery.data) {
      setPathIds(ancestorPathQuery.data)
    }
  }, [value, ancestorPathQuery.data])

  const lastSelectedId = pathIds[pathIds.length - 1]
  const lastSelectedQuery = useQuery({
    queryKey: ['physical-warehouse-filter-item', lastSelectedId],
    queryFn: () => getPhysicalWarehouseItem(lastSelectedId!),
    enabled: Boolean(lastSelectedId),
    staleTime: 60_000,
  })

  const lastSelectedItem = lastSelectedQuery.data
  const showChildLevel =
    Boolean(lastSelectedItem) && !lastSelectedItem?.isBottomLevel

  const levelCount = Math.max(
    1,
    pathIds.length + (showChildLevel ? 1 : 0),
  )

  const parentIdsForQueries = useMemo(
    () =>
      Array.from({ length: levelCount }, (_, depth) =>
        depth === 0 ? undefined : pathIds[depth - 1],
      ),
    [levelCount, pathIds],
  )

  const levelQueries = useQueries({
    queries: parentIdsForQueries.map((parentId) => ({
      queryKey: ['archive-physical-location-items', parentId ?? 'root'],
      queryFn: () =>
        getArchivePhysicalLocationItems(
          parentId
            ? { parentId, availableOnly: false }
            : { availableOnly: false },
        ),
      staleTime: 15_000,
    })),
  })

  function handleLevelChange(depth: number, nextValue: string) {
    if (nextValue === ALL_VALUE) {
      if (depth === 0) {
        setPathIds([])
        onValueChange(undefined)
        return
      }

      const parentPath = pathIds.slice(0, depth)
      setPathIds(parentPath)
      onValueChange(parentPath[parentPath.length - 1])
      return
    }

    const nextPath = [...pathIds.slice(0, depth), nextValue]
    setPathIds(nextPath)
    onValueChange(nextValue)
  }

  const rootQuery = levelQueries[0]

  if (rootQuery?.isPending || (value && ancestorPathQuery.isPending)) {
    return (
      <PhysicalWarehouseStatusMessage label={t('disposal.filters.physicalLocation')}>
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t('disposal.filters.physicalLoading')}
      </PhysicalWarehouseStatusMessage>
    )
  }

  if (rootQuery?.isError) {
    return (
      <PhysicalWarehouseStatusMessage
        label={t('disposal.filters.physicalLocation')}
        tone="destructive"
      >
        {t('disposal.filters.physicalLoadFailed')}
      </PhysicalWarehouseStatusMessage>
    )
  }

  if ((rootQuery?.data ?? []).length === 0) {
    return (
      <PhysicalWarehouseStatusMessage label={t('disposal.filters.physicalLocation')}>
        {t('disposal.filters.noPhysicalLocations')}
      </PhysicalWarehouseStatusMessage>
    )
  }

  return (
    <div
      className={cn(
        layout === 'grid'
          ? 'grid w-full grid-cols-2 gap-x-4 gap-y-4'
          : 'flex flex-wrap items-end gap-3',
      )}
    >
      {Array.from({ length: levelCount }, (_, depth) => {
        const selectedId = pathIds[depth]
        const query = levelQueries[depth]
        const items = (query?.data ?? []) as Array<PhysicalWarehouseItemT>
        const loading = query?.isPending ?? false

        return (
          <div
            key={`physical-level-${depth}`}
            className={layout === 'grid' ? 'min-w-0 space-y-2' : 'min-w-[180px]'}
          >
            <span
              className={cn(
                'block text-muted-foreground',
                layout === 'grid'
                  ? 'text-sm font-medium text-foreground'
                  : 'mb-1 text-xs',
              )}
            >
              {levelLabel(depth, t)}
            </span>
            <Select
              value={selectedId ?? ALL_VALUE}
              onValueChange={(nextValue) => handleLevelChange(depth, nextValue)}
              disabled={disabled || loading}
            >
              <SelectTrigger className={layout === 'grid' ? 'w-full' : undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>
                  {depth === 0
                    ? t('disposal.filters.allPhysicalLocations')
                    : t('disposal.filters.allAtPhysicalLevel')}
                </SelectItem>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </div>
  )
}
