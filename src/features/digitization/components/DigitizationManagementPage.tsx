import { Link } from '@tanstack/react-router'
import { FolderOpen, FolderTree, ScanLine, ScanSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useDataManagementHubAccess } from '@/features/digitization/hooks/useDataManagementHubAccess'
import { useDraftDossiersAccess } from '@/features/digitization/hooks/useDraftDossiersAccess'
import { useScanIntakeAccess } from '@/features/digitization/hooks/useScanIntakeAccess'
import { useOcrControlAccess } from '@/features/ocr-control/hooks/useOcrControlAccess'
import {
  IconHubPageLayout,
  iconHubNestedTileGridClassName,
  iconHubNestedTileGridGapClassName,
  iconHubNestedTileIconClassName,
  iconHubNestedTileIconWrapClassName,
  iconHubNestedTileLabelClassName,
  iconHubNestedTileLinkClassName,
} from '@/features/navigation/components/IconHubPageLayout'
import { cn } from '@/lib/utils/cn'

type DigitizationTileTo =
  | '/app/scan-intake'
  | '/app/data'
  | '/app/ocr-control'
  | '/app/dossiers'

export function DigitizationManagementPage() {
  const { t } = useTranslation('digitization')
  const { t: tCommon } = useTranslation('common')
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
    <IconHubPageLayout
      title={t('title')}
      maxWidth="max-w-6xl"
      back={{
        to: '/app/digitization-hub',
        parentLabel: tCommon('admin.groups.digitization'),
        backAriaLabel: tCommon('hubBack.aria', {
          target: tCommon('admin.groups.digitization'),
        }),
      }}
    >
      <div
        className={cn(
          iconHubNestedTileGridClassName,
          iconHubNestedTileGridGapClassName,
        )}
      >
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.id}
              to={tile.to}
              className={iconHubNestedTileLinkClassName}
            >
              <span className={iconHubNestedTileIconWrapClassName}>
                <Icon
                  className={iconHubNestedTileIconClassName}
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
              <span className={iconHubNestedTileLabelClassName}>
                {tile.label}
              </span>
            </Link>
          )
        })}
      </div>
    </IconHubPageLayout>
  )
}
