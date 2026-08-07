import { Link } from '@tanstack/react-router'
import { FolderOpen, FolderTree, ScanLine, ScanSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  digitizationTabsListClassName,
  digitizationTabsTriggerClassName,
  digitizationTabsTriggerCompactClassName,
} from '@/features/digitization/components/DigitizationBackNav'
import { useDataManagementHubAccess } from '@/features/digitization/hooks/useDataManagementHubAccess'
import { useDraftDossiersAccess } from '@/features/digitization/hooks/useDraftDossiersAccess'
import { useScanIntakeAccess } from '@/features/digitization/hooks/useScanIntakeAccess'
import { useOcrControlAccess } from '@/features/ocr-control/hooks/useOcrControlAccess'
import { cn } from '@/lib/utils/cn'

export type DigitizationSectionTabT = 'scan' | 'data' | 'ocr' | 'drafts'

type DigitizationSectionTabItem = {
  id: DigitizationSectionTabT
  to: '/app/scan-intake' | '/app/data' | '/app/ocr-control' | '/app/dossiers'
  label: string
  icon: LucideIcon
}

export function useDigitizationSectionTabs(): Array<DigitizationSectionTabItem> {
  const { t } = useTranslation('digitization')
  const { canUseScanIntake } = useScanIntakeAccess()
  const { canViewDataManagement } = useDataManagementHubAccess()
  const { canViewOcrControl } = useOcrControlAccess()
  const { canViewDraftDossiers } = useDraftDossiersAccess()

  return useMemo(() => {
    const items: Array<DigitizationSectionTabItem> = []

    if (canUseScanIntake) {
      items.push({
        id: 'scan',
        to: '/app/scan-intake',
        label: t('sectionTabs.scanIntake'),
        icon: ScanLine,
      })
    }
    if (canViewDataManagement) {
      items.push({
        id: 'data',
        to: '/app/data',
        label: t('sectionTabs.dataManagement'),
        icon: FolderTree,
      })
    }
    if (canViewOcrControl) {
      items.push({
        id: 'ocr',
        to: '/app/ocr-control',
        label: t('sectionTabs.ocrControl'),
        icon: ScanSearch,
      })
    }
    if (canViewDraftDossiers) {
      items.push({
        id: 'drafts',
        to: '/app/dossiers',
        label: t('sectionTabs.draftDossiers'),
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
}

export function DigitizationSectionTabs({
  active,
  compact = false,
}: {
  active: DigitizationSectionTabT
  compact?: boolean
}) {
  const tabs = useDigitizationSectionTabs()

  if (tabs.length <= 1) {
    return null
  }

  const triggerClassName = compact
    ? digitizationTabsTriggerCompactClassName
    : digitizationTabsTriggerClassName

  return (
    <nav
      className={cn(digitizationTabsListClassName, 'shrink-0')}
      aria-label="Digitization sections"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active

        return (
          <Link
            key={tab.id}
            to={tab.to}
            className={cn(triggerClassName, 'inline-flex items-center')}
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
