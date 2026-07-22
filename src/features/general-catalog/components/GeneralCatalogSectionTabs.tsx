import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Clock3,
  FileText,
  FolderKanban,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useFondAccess } from '@/features/archive-fond/hooks/useFondAccess'
import { useDocumentTypeAccess } from '@/features/document-type/hooks/useDocumentTypeAccess'
import { useDossierTypeAccess } from '@/features/dossier-type/hooks/useDossierTypeAccess'
import { useInventoryAccess } from '@/features/inventory/hooks/useInventoryAccess'
import {
  sectionBoxedTabsListClassName,
  sectionBoxedTabsTriggerCompactClassName,
} from '@/features/navigation/components/SectionBackNav'
import { useRetentionPeriodAccess } from '@/features/retention-period/hooks/useRetentionPeriodAccess'
import { useSecurityLevelAccess } from '@/features/security-level/hooks/useSecurityLevelAccess'
import { cn } from '@/lib/utils/cn'

export type GeneralCatalogSectionT =
  | 'fonds'
  | 'retention'
  | 'inventory'
  | 'dossier-type'
  | 'document-type'
  | 'security-level'

type GeneralCatalogSectionTabItem = {
  id: GeneralCatalogSectionT
  to:
    | '/app/archive-fonds'
    | '/app/retention-periods'
    | '/app/inventories'
    | '/app/dossier-types'
    | '/app/document-types'
    | '/app/security-levels'
  label: string
  icon: LucideIcon
}

export function useGeneralCatalogSectionTabs(): Array<GeneralCatalogSectionTabItem> {
  const { t } = useTranslation('general-catalog')
  const { canViewFonds } = useFondAccess()
  const { canViewRetentionPeriods } = useRetentionPeriodAccess()
  const { canViewInventories } = useInventoryAccess()
  const { canViewDossierTypes } = useDossierTypeAccess()
  const { canViewDocumentTypes } = useDocumentTypeAccess()
  const { canViewSecurityLevels } = useSecurityLevelAccess()

  return useMemo(() => {
    const items: Array<GeneralCatalogSectionTabItem> = []

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
}

export function GeneralCatalogSectionTabs({
  active,
}: {
  active: GeneralCatalogSectionT
}) {
  const tabs = useGeneralCatalogSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  return (
    <nav
      className={cn(sectionBoxedTabsListClassName, 'shrink-0')}
      aria-label="General catalog sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active

        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(
              sectionBoxedTabsTriggerCompactClassName,
              'inline-flex items-center',
            )}
            data-state={isActive ? 'active' : 'inactive'}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
