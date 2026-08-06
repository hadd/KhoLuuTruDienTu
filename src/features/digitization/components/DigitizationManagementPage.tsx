import { Link } from '@tanstack/react-router'
import { FolderOpen, FolderTree, ScanLine, ScanSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useDataManagementHubAccess } from '@/features/digitization/hooks/useDataManagementHubAccess'
import { useDraftDossiersAccess } from '@/features/digitization/hooks/useDraftDossiersAccess'
import { useScanIntakeAccess } from '@/features/digitization/hooks/useScanIntakeAccess'
import { useOcrControlAccess } from '@/features/ocr-control/hooks/useOcrControlAccess'
import { cn } from '@/lib/utils/cn'

type DigitizationTileTo =
  | '/app/scan-intake'
  | '/app/data'
  | '/app/ocr-control'
  | '/app/dossiers'

export function DigitizationManagementPage() {
  const { t } = useTranslation('digitization')
  const { canUseScanIntake } = useScanIntakeAccess()
  const { canViewDataManagement } = useDataManagementHubAccess()
  const { canViewOcrControl } = useOcrControlAccess()
  const { canViewDraftDossiers } = useDraftDossiersAccess()

  const tiles = useMemo(() => {
    const items: Array<{
      id: string
      to: DigitizationTileTo
      label: string
      icon: LucideIcon
    }> = []

    if (canUseScanIntake) {
      items.push({
        id: 'scan',
        to: '/app/scan-intake',
        label: t('tiles.scanIntake'),
        icon: ScanLine,
      })
    }
    if (canViewDataManagement) {
      items.push({
        id: 'data',
        to: '/app/data',
        label: t('tiles.dataManagement'),
        icon: FolderTree,
      })
    }
    if (canViewOcrControl) {
      items.push({
        id: 'ocr-control',
        to: '/app/ocr-control',
        label: t('tiles.ocrControl'),
        icon: ScanSearch,
      })
    }
    if (canViewDraftDossiers) {
      items.push({
        id: 'drafts',
        to: '/app/dossiers',
        label: t('tiles.draftDossiers'),
        icon: FolderOpen,
      })
    }

    return items
  }, [
    canUseScanIntake,
    canViewDataManagement,
    canViewOcrControl,
    canViewDraftDossiers,
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
      <div
        className={cn(
          'flex w-full flex-col items-center gap-10 sm:gap-12',
          tiles.length >= 4
            ? 'max-w-6xl'
            : tiles.length >= 3
              ? 'max-w-5xl'
              : 'max-w-3xl',
        )}
      >
        <h1 className="text-2xl font-bold uppercase tracking-[0.06em] text-primary sm:text-[1.75rem]">
          {t('title')}
        </h1>

        <div
          className={cn(
            'grid w-full gap-8 sm:gap-10',
            tiles.length === 1 && 'max-w-xs grid-cols-1',
            tiles.length === 2 && 'grid-cols-1 sm:grid-cols-2',
            tiles.length === 3 && 'grid-cols-1 sm:grid-cols-3',
            tiles.length >= 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          )}
        >
          {tiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.id}
                to={tile.to}
                className="group flex flex-col items-center gap-4 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-36 items-center justify-center rounded-[2rem] bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-44">
                  <Icon
                    className="size-16 sm:size-20"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
                <span className="text-center text-lg font-medium text-foreground transition-colors group-hover:text-primary sm:text-xl">
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
