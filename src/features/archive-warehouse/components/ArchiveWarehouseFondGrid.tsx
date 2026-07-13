import { Archive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ArchiveFondT } from '@/features/archive-fond/types'
import { cn } from '@/lib/utils/cn'

type ArchiveWarehouseFondGridProps = {
  fonds: Array<ArchiveFondT>
  selectedFondId?: string
  onSelect: (fondId: string) => void
}

export function ArchiveWarehouseFondGrid({
  fonds,
  selectedFondId,
  onSelect,
}: ArchiveWarehouseFondGridProps) {
  const { t } = useTranslation('archive-warehouse')

  if (fonds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('page.fondListEmpty')}</p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {fonds.map((fond) => {
        const selected = fond.id === selectedFondId
        return (
          <button
            key={fond.id}
            type="button"
            onClick={() => onSelect(fond.id)}
            aria-pressed={selectedFondId ? selected : undefined}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center transition-colors',
              'hover:border-primary/50 hover:bg-accent/40',
              selected && 'border-primary bg-primary/5 ring-1 ring-primary/30',
            )}
          >
            <span
              className={cn(
                'flex size-14 items-center justify-center rounded-xl bg-muted text-muted-foreground',
                selected && 'bg-primary/10 text-primary',
              )}
            >
              <Archive className="size-7" aria-hidden />
            </span>
            <span className="line-clamp-2 w-full text-sm font-medium text-foreground">
              {fond.fondName}
            </span>
            <span className="line-clamp-1 w-full text-xs text-muted-foreground">
              {fond.id}
            </span>
          </button>
        )
      })}
    </div>
  )
}
