import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Clock3, FileText, FolderKanban, ScrollText } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useFondAccess } from '@/features/archive-fond/hooks/useFondAccess'
import { useDocumentTypeAccess } from '@/features/document-type/hooks/useDocumentTypeAccess'
import { useDossierTypeAccess } from '@/features/dossier-type/hooks/useDossierTypeAccess'
import { useInventoryAccess } from '@/features/inventory/hooks/useInventoryAccess'
import { useRetentionPeriodAccess } from '@/features/retention-period/hooks/useRetentionPeriodAccess'

type CatalogTileTo =
  | '/app/archive-fonds'
  | '/app/retention-periods'
  | '/app/inventories'
  | '/app/dossier-types'
  | '/app/document-types'

export function GeneralCatalogPage() {
  const { t } = useTranslation('general-catalog')
  const { canViewFonds } = useFondAccess()
  const { canViewRetentionPeriods } = useRetentionPeriodAccess()
  const { canViewInventories } = useInventoryAccess()
  const { canViewDossierTypes } = useDossierTypeAccess()
  const { canViewDocumentTypes } = useDocumentTypeAccess()

  const tiles = useMemo(() => {
    const items: Array<{
      id: string
      to: CatalogTileTo
      label: string
      icon: LucideIcon
    }> = []

    if (canViewFonds) {
      items.push({
        id: 'fonds',
        to: '/app/archive-fonds',
        label: t('tiles.fonds'),
        icon: ScrollText,
      })
    }
    if (canViewRetentionPeriods) {
      items.push({
        id: 'retention',
        to: '/app/retention-periods',
        label: t('tiles.retention'),
        icon: Clock3,
      })
    }
    if (canViewInventories) {
      items.push({
        id: 'inventory',
        to: '/app/inventories',
        label: t('tiles.inventory'),
        icon: BookOpen,
      })
    }
    if (canViewDossierTypes) {
      items.push({
        id: 'dossier-type',
        to: '/app/dossier-types',
        label: t('tiles.dossierType'),
        icon: FolderKanban,
      })
    }
    if (canViewDocumentTypes) {
      items.push({
        id: 'document-type',
        to: '/app/document-types',
        label: t('tiles.documentType'),
        icon: FileText,
      })
    }
    return items
  }, [
    canViewFonds,
    canViewRetentionPeriods,
    canViewInventories,
    canViewDossierTypes,
    canViewDocumentTypes,
    t,
  ])

  if (tiles.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        {t('noPermission')}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center px-6 pt-10 pb-16 sm:pt-14">
      <div className="flex w-full max-w-5xl flex-col items-center gap-8 sm:gap-10">
        <h1 className="flex items-center gap-3 text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
          <span className="inline-block h-7 w-1 shrink-0 rounded-sm bg-primary sm:h-8" />
          {t('title')}
        </h1>

        <div className="grid w-full grid-cols-2 gap-6 sm:gap-8 md:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.id}
                to={tile.to}
                className="group flex flex-col items-center gap-3 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-[4.5rem] items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-20">
                  <Icon
                    className="size-9 sm:size-10"
                    strokeWidth={1.6}
                    aria-hidden
                  />
                </span>
                <span className="text-center text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-[0.95rem]">
                  {tile.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
