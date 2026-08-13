import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Clock3, FileText, FolderKanban, ScrollText, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useFondAccess } from '@/features/archive-fond/hooks/useFondAccess'
import { useDocumentTypeAccess } from '@/features/document-type/hooks/useDocumentTypeAccess'
import { useDossierTypeAccess } from '@/features/dossier-type/hooks/useDossierTypeAccess'
import { useInventoryAccess } from '@/features/inventory/hooks/useInventoryAccess'
import { useRetentionPeriodAccess } from '@/features/retention-period/hooks/useRetentionPeriodAccess'
import { useSecurityLevelAccess } from '@/features/security-level/hooks/useSecurityLevelAccess'
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

type CatalogTileTo =
  | '/app/archive-fonds'
  | '/app/retention-periods'
  | '/app/inventories'
  | '/app/dossier-types'
  | '/app/document-types'
  | '/app/security-levels'

export function GeneralCatalogPage() {
  const { t } = useTranslation('general-catalog')
  const { t: tCommon } = useTranslation('common')
  const { canViewFonds } = useFondAccess()
  const { canViewRetentionPeriods } = useRetentionPeriodAccess()
  const { canViewInventories } = useInventoryAccess()
  const { canViewDossierTypes } = useDossierTypeAccess()
  const { canViewDocumentTypes } = useDocumentTypeAccess()
  const { canViewSecurityLevels } = useSecurityLevelAccess()

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
    if (canViewSecurityLevels) {
      items.push({
        id: 'security-level',
        to: '/app/security-levels',
        label: t('tiles.securityLevel'),
        icon: ShieldCheck,
      })
    }
    return items
  }, [
    canViewFonds,
    canViewRetentionPeriods,
    canViewInventories,
    canViewDossierTypes,
    canViewDocumentTypes,
    canViewSecurityLevels,
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
        to: '/app/system-admin',
        parentLabel: tCommon('admin.groups.systemAdmin'),
        backAriaLabel: tCommon('hubBack.aria', {
          target: tCommon('admin.groups.systemAdmin'),
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
