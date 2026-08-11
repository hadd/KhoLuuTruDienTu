import { Loader2, MapPin, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { PhysicalWarehouseSearchHitT } from '@/features/physical-warehouse/types'
import { physicalWarehouseSearchResultKey } from '@/features/physical-warehouse/lib/physicalWarehouseSearchNav'
import { cn } from '@/lib/utils/cn'

type PhysicalWarehouseSearchResultsProps = {
  items: Array<PhysicalWarehouseSearchHitT>
  isLoading: boolean
  tookMs?: number | null
  message?: string | null
  mode?: 'all' | 'content' | 'metadata'
  onSelect: (hit: PhysicalWarehouseSearchHitT) => void
}

export function PhysicalWarehouseSearchResults({
  items,
  isLoading,
  tookMs,
  message,
  mode = 'all',
  onSelect,
}: PhysicalWarehouseSearchResultsProps) {
  const { t } = useTranslation('physical-warehouse')
  const { t: tArchive } = useTranslation('archive-warehouse')

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

              {hit.snippet ? (
                <p
                  className="mt-2 text-sm text-muted-foreground [&_em]:font-semibold [&_em]:not-italic [&_em]:text-foreground"
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
