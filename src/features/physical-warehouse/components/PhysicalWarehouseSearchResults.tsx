import { Loader2, MapPin, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  hasWarehouseMetadataFieldSearch,
  resolveWarehouseMetadataSearchLines,
} from '@/features/archive-warehouse/lib/warehouseMetadataSearchDisplay'
import type { ArchiveWarehouseSearchHitT } from '@/features/archive-warehouse/types'
import { physicalWarehouseSearchResultKey } from '@/features/physical-warehouse/lib/physicalWarehouseSearchNav'
import type { PhysicalWarehouseSearchHitT } from '@/features/physical-warehouse/types'
import { cn } from '@/lib/utils/cn'

type PhysicalWarehouseSearchResultsProps = {
  items: Array<PhysicalWarehouseSearchHitT>
  isLoading: boolean
  tookMs?: number | null
  message?: string | null
  mode?: 'all' | 'content' | 'metadata'
  searchFields?: string | string[]
  searchQuery?: string
  onSelect: (hit: PhysicalWarehouseSearchHitT) => void
}

const metadataValueClassName =
  'text-sm text-muted-foreground [&_em]:font-semibold [&_em]:not-italic [&_em]:text-foreground [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:font-semibold [&_mark]:text-foreground'

export function PhysicalWarehouseSearchResults({
  items,
  isLoading,
  tookMs,
  message,
  mode = 'all',
  searchFields,
  searchQuery,
  onSelect,
}: PhysicalWarehouseSearchResultsProps) {
  const { t } = useTranslation('physical-warehouse')
  const { t: tArchive } = useTranslation('archive-warehouse')
  const metadataFieldSearch = hasWarehouseMetadataFieldSearch(searchFields)

  if (isLoading && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isLoading && items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {message ?? tArchive('page.noMatch')}
      </Card>
    )
  }

  const searchHint =
    mode === 'content'
      ? tArchive('page.contentSearchHint')
      : mode === 'metadata'
        ? tArchive('page.metadataSearchHint')
        : tArchive('page.unifiedSearchHint')

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="size-3.5" aria-hidden />
        {searchHint}
        {tookMs != null
          ? ` · ${tArchive('page.searchTook', { ms: tookMs })}`
          : null}
      </p>

      <div className="space-y-2">
        {items.map((hit) => {
          const hasPlacement =
            hit.physicalPlacement != null &&
            hit.physicalPlacement.ancestorIds.length >= 2
          const metadataLines = metadataFieldSearch
            ? resolveWarehouseMetadataSearchLines(
                hit as ArchiveWarehouseSearchHitT,
                searchFields,
                searchQuery,
              )
            : []

          return (
            <button
              key={physicalWarehouseSearchResultKey(hit)}
              type="button"
              className={cn(
                'w-full rounded-lg border bg-card p-4 text-left transition-colors',
                hasPlacement
                  ? 'hover:bg-accent/40 cursor-pointer'
                  : 'cursor-default opacity-95',
              )}
              onClick={() => onSelect(hit)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{hit.title}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {hit.fondName ? (
                    <Badge variant="secondary">{hit.fondName}</Badge>
                  ) : null}
                  {hit.physicalPlacement?.breadcrumb ? (
                    <Badge variant="outline" className="gap-1 font-normal">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      {hit.physicalPlacement.breadcrumb}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      {t('search.noPhysicalPlacement')}
                    </Badge>
                  )}
                </div>
              </div>

              {metadataFieldSearch ? (
                metadataLines.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {metadataLines.map((line) => (
                      <div key={`${hit.entityId}-${line.fieldKey}`} className="text-sm">
                        <span className="text-foreground">{line.label}: </span>
                        <span
                          className={metadataValueClassName}
                          dangerouslySetInnerHTML={{ __html: line.valueHtml }}
                        />
                        {line.fileName ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {line.fileName}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null
              ) : hit.snippet ? (
                <p
                  className={`mt-2 ${metadataValueClassName}`}
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              ) : null}

              {hasPlacement ? (
                <p className="mt-2 text-xs text-primary">
                  {t('search.navigateToBox')}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
