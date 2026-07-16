import { Loader2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type {
  ArchiveWarehouseSearchHitT,
  ArchiveWarehouseSearchMatchT,
} from '@/features/archive-warehouse/types'

type ArchiveWarehouseSearchResultsProps = {
  items: Array<ArchiveWarehouseSearchHitT>
  isLoading: boolean
  tookMs?: number | null
  message?: string | null
  mode?: 'content' | 'metadata'
  onSelect: (
    hit: ArchiveWarehouseSearchHitT,
    match?: ArchiveWarehouseSearchMatchT,
  ) => void
}

export function ArchiveWarehouseSearchResults({
  items,
  isLoading,
  tookMs,
  message,
  mode = 'content',
  onSelect,
}: ArchiveWarehouseSearchResultsProps) {
  const { t } = useTranslation('archive-warehouse')

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
        {message ?? t('page.noMatch')}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Search className="size-3.5" aria-hidden />
        {mode === 'content'
          ? t('page.contentSearchHint')
          : t('page.metadataSearchHint')}
        {tookMs != null ? ` · ${t('page.searchTook', { ms: tookMs })}` : null}
      </p>

      <div className="space-y-2">
        {items.map((hit) => (
          <button
            key={`${hit.entityType}-${hit.entityId}`}
            type="button"
            className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40"
            onClick={() => onSelect(hit, hit.matches?.[0])}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{hit.title}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {hit.fondName ? (
                  <Badge variant="secondary">{hit.fondName}</Badge>
                ) : null}
                <Badge variant="outline">{t('status.ARCHIVED')}</Badge>
              </div>
            </div>

            {hit.dossierTypeName ||
            hit.documentTypeNames?.length ||
            hit.effectiveRetentionPeriodName ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  hit.dossierTypeName
                    ? `${t('filters.dossierType')}: ${hit.dossierTypeName}`
                    : null,
                  hit.documentTypeNames?.length
                    ? `${t('filters.documentType')}: ${hit.documentTypeNames.join(', ')}`
                    : null,
                  hit.effectiveRetentionPeriodName
                    ? `${t('detail.effectiveRetention')}: ${hit.effectiveRetentionPeriodName}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}

            {hit.snippet ? (
              <p
                className="mt-2 text-sm text-muted-foreground [&_em]:font-semibold [&_em]:not-italic [&_em]:text-foreground [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:font-semibold [&_mark]:text-foreground"
                dangerouslySetInnerHTML={{ __html: hit.snippet }}
              />
            ) : null}

            {hit.matches?.[0]?.fileName ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {hit.matches[0].fileName}
                {hit.matches[0].page != null
                  ? ` · trang ${hit.matches[0].page}`
                  : ''}
              </p>
            ) : null}

            {typeof hit.metadata?.folderPath === 'string' ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {hit.metadata.folderPath}
              </p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
